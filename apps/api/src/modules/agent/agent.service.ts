import { Injectable, Logger } from '@nestjs/common';
import type { AgentAction, Prisma } from '@prisma/client';
import type {
  AgentChatInput,
  AgentChatResponse,
  AgentConversationView,
  AgentEngine,
  AgentMessageView,
  AgentStatus,
  ToolCallView,
} from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { notFound } from '../../common/http/errors';
import { toActionView } from '../../common/mappers';
import { AppConfig } from '../../config/app-config';
import { AiService } from '../ai/ai.service';
import { EmbeddingService } from '../ai/embedding.service';
import type { ChatMessage } from '../ai/ai.types';
import { ContextBuilderService, type ContextPackage } from './context-builder.service';
import { LangflowClient } from './langflow.client';
import { PlannerEngine, type EngineResult } from './planner.engine';
import { ORBIT_SYSTEM_PROMPT } from './system-prompt';
import { ToolRegistryService, toolDefinitions } from './tool-registry.service';

type GroundedFallback = Error & { draft?: EngineResult };

const MAX_TOOL_ROUNDS = 4;
const HISTORY_MESSAGES = 8;

/**
 * Orbit Career Agent gateway. One orchestrator agent, many tools.
 *
 *   React → NestJS (this service) → Langflow (Orbit Agent flow) → tools → NestJS tool API
 *
 * Fallback chain keeps the agent available: Langflow → direct model tool loop → deterministic planner.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger('OrbitAgent');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly ai: AiService,
    private readonly embeddings: EmbeddingService,
    private readonly langflow: LangflowClient,
    private readonly contextBuilder: ContextBuilderService,
    private readonly tools: ToolRegistryService,
    private readonly planner: PlannerEngine,
  ) {}

  async status(): Promise<AgentStatus> {
    const [langflowReachable, aiReachable] = await Promise.all([this.langflow.isReachable(true), this.ai.isAvailable(true)]);
    const interactive = aiReachable && this.modelIsInteractive();
    const skippedReason = this.langflowSkipReason();
    const langflowActive = langflowReachable && !skippedReason;
    return {
      activeEngine: langflowActive ? 'langflow' : interactive ? 'direct' : 'planner',
      langflow: {
        configured: this.langflow.configured,
        reachable: langflowReachable,
        flowId: this.langflow.flowId,
        modelProvider: this.config.env.LANGFLOW_MODEL_PROVIDER,
        skippedReason: langflowReachable ? skippedReason : null,
      },
      ai: { provider: this.ai.provider.name, model: this.ai.provider.model, reachable: aiReachable, throughput: this.ai.throughput, interactive },
      embeddings: { provider: this.embeddings.provider, model: this.embeddings.modelTag },
    };
  }

  async chat(userId: string, input: AgentChatInput): Promise<AgentChatResponse> {
    const conversation = input.conversationId
      ? await this.prisma.agentConversation.findFirst({ where: { id: input.conversationId, userId } })
      : await this.prisma.agentConversation.create({ data: { userId, title: input.message.slice(0, 60) } });
    if (!conversation) throw notFound('Conversation');

    const turnStart = new Date();
    await this.prisma.agentMessage.create({
      data: { conversationId: conversation.id, role: 'USER', content: input.message, metadata: { pageContext: input.pageContext ?? null } as Prisma.InputJsonValue },
    });
    const context = await this.contextBuilder.build(userId, input.pageContext);

    let engine: AgentEngine = 'planner';
    let notice: string | null = null;
    let result: EngineResult | null = null;

    if (this.langflow.configured && !this.langflowSkipReason() && (await this.langflow.isReachable())) {
      try {
        result = await this.runLangflow(userId, conversation.id, input.message, context, turnStart);
        engine = 'langflow';
      } catch (error) {
        this.logger.warn(`Langflow failed, falling back: ${(error as Error).message}`);
        notice = 'Langflow is unavailable right now — Orbit answered with its built-in reasoning.';
      }
    }
    if (!result && (await this.ai.isAvailable()) && this.modelIsInteractive()) {
      try {
        result = this.config.agentNativeToolCalling
          ? await this.runDirect(userId, conversation.id, input.message, context)
          : await this.runGrounded(userId, conversation.id, input.message, context, input.pageContext);
        engine = 'direct';
      } catch (error) {
        const draft = (error as GroundedFallback).draft;
        if (draft) result = draft;
        this.logger.warn(`Direct model failed, falling back: ${(error as Error).message}`);
        notice = 'The AI model is slow or unavailable right now — Orbit answered with its built-in planner.';
      }
    }
    if (!result) {
      result = await this.planner.run(userId, input.message, context, input.pageContext, conversation.id);
      engine = 'planner';
    }

    const message = await this.prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: result.content,
        metadata: { engine, toolCalls: result.toolCalls, actionIds: result.actions.map((a) => a.id) } as unknown as Prisma.InputJsonValue,
      },
    });
    if (result.actions.length) {
      await this.prisma.agentAction.updateMany({ where: { id: { in: result.actions.map((a) => a.id) } }, data: { messageId: message.id } });
    }
    await this.prisma.agentConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    return {
      conversationId: conversation.id,
      engine,
      notice,
      message: {
        id: message.id,
        role: 'ASSISTANT',
        content: result.content,
        engine,
        toolCalls: result.toolCalls,
        actions: this.cardActions(result.actions).map(toActionView),
        createdAt: message.createdAt.toISOString(),
      },
    };
  }

  /**
   * Langflow is skipped (instead of making the user wait for a timeout) when the flow runs on the
   * same local Ollama model Orbit has measured as too slow for live answers on this machine.
   */
  private langflowSkipReason(): string | null {
    if (this.config.env.LANGFLOW_MODEL_PROVIDER !== 'ollama' || this.ai.provider.name !== 'ollama') return null;
    if (this.ai.throughput === null) return 'Measuring the local model’s speed before routing chats through Langflow.';
    if (this.modelIsInteractive()) return null;
    return 'The flow uses the local Ollama model, which is too slow on this machine. Point it at Groq or watsonx (pnpm langflow:setup).';
  }

  /** Can the configured model answer within AGENT_TIMEOUT_MS on this hardware? */
  private modelIsInteractive(): boolean {
    const sample = [{ role: 'user' as const, content: 'x'.repeat(4000) }];
    return this.ai.canFinish(sample, 450, this.config.env.AGENT_TIMEOUT_MS);
  }

  /** Only actionable cards are shown; read audits stay in the audit log. */
  private cardActions(actions: AgentAction[]): AgentAction[] {
    const seen = new Set<string>();
    return actions.filter((a) => {
      if (!['SUGGESTED', 'PENDING_CONFIRMATION'].includes(a.status)) return false;
      const key = `${a.type}:${JSON.stringify(a.payload)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private composeInput(message: string, context: ContextPackage): string {
    return `[ORBIT CONTEXT]\n${JSON.stringify(context)}\n[/ORBIT CONTEXT]\n\n[USER MESSAGE]\n${message}`;
  }

  // -------------------------------------------------------------------------
  // Engines
  // -------------------------------------------------------------------------

  private async runLangflow(userId: string, conversationId: string, message: string, context: ContextPackage, turnStart: Date): Promise<EngineResult> {
    const content = await this.langflow.run(this.composeInput(message, context), conversationId);
    // Tools invoked by Langflow call back into /agent/tools/* and are recorded against this conversation.
    const actions = await this.prisma.agentAction.findMany({ where: { userId, conversationId, createdAt: { gte: turnStart } }, orderBy: { createdAt: 'asc' } });
    const toolCalls: ToolCallView[] = actions.map((a) => ({ tool: a.tool as ToolCallView['tool'], summary: a.outputSummary ?? a.title, durationMs: 0 }));
    return { content, toolCalls, actions };
  }

  /**
   * Grounded generation for small local models: Orbit's planner selects and runs
   * the tools deterministically, then the model writes the answer from verified
   * results only. Fast, reliable, and never invents data.
   */
  private async runGrounded(userId: string, conversationId: string, message: string, context: ContextPackage, page: AgentChatInput['pageContext']): Promise<EngineResult> {
    const draft = await this.planner.run(userId, message, context, page, conversationId);
    try {
      const res = await this.ai.chat(
        [
          { role: 'system', content: ORBIT_SYSTEM_PROMPT },
          {
            role: 'user',
            content:
              `User question: ${message}\n\n` +
              `Verified Orbit analysis (from tools: ${draft.toolCalls.map((t) => t.tool).join(', ') || 'context'}):\n${draft.content}\n\n` +
              `Rewrite this into your final answer for the user. Keep every fact, number and the four headings; make it warm, specific and concise. Do not add facts that are not above.`,
          },
        ],
        { temperature: 0.3, maxTokens: 650, timeoutMs: this.config.env.AGENT_TIMEOUT_MS },
      );
      const content = res.content.trim();
      if (content.length < 80 || !content.includes('#')) throw new Error('Model answer was too short or unstructured');
      return { ...draft, content };
    } catch (error) {
      const err = new Error((error as Error).message) as GroundedFallback;
      err.draft = draft;
      throw err;
    }
  }

  private async runDirect(userId: string, conversationId: string, message: string, context: ContextPackage): Promise<EngineResult> {
    const history = await this.prisma.agentMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' }, take: HISTORY_MESSAGES + 1 });
    const messages: ChatMessage[] = [
      { role: 'system', content: ORBIT_SYSTEM_PROMPT },
      { role: 'system', content: `[ORBIT CONTEXT]\n${JSON.stringify(context)}` },
      ...history
        .reverse()
        .slice(0, -1)
        .map((m) => ({ role: m.role === 'USER' ? ('user' as const) : ('assistant' as const), content: m.content.slice(0, 2000) })),
      { role: 'user', content: message },
    ];
    const toolCalls: ToolCallView[] = [];
    const actions: AgentAction[] = [];
    const defs = toolDefinitions();

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await this.ai.chat(messages, {
        tools: round < MAX_TOOL_ROUNDS ? defs : undefined,
        temperature: 0.3,
        maxTokens: 900,
        timeoutMs: this.config.env.AGENT_TIMEOUT_MS,
      });
      if (!res.toolCalls.length) {
        const content = res.content.trim();
        if (!content) throw new Error('Model returned an empty answer');
        return { content, toolCalls, actions };
      }
      messages.push({ role: 'assistant', content: res.content ?? '', toolCalls: res.toolCalls });
      for (const call of res.toolCalls) {
        const started = Date.now();
        const r = await this.tools.execute(userId, call.name, call.arguments, conversationId);
        toolCalls.push({ tool: call.name as ToolCallView['tool'], summary: r.summary, durationMs: Date.now() - started });
        actions.push(...r.actions);
        messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(r.data).slice(0, 6000) });
      }
    }
    throw new Error('Agent exceeded tool rounds');
  }

  // -------------------------------------------------------------------------
  // Tool API for Langflow
  // -------------------------------------------------------------------------

  async executeToolForSession(sessionId: string, tool: string, args: Record<string, unknown>) {
    const conversation = await this.prisma.agentConversation.findUnique({ where: { id: sessionId } });
    if (!conversation) throw notFound('Session');
    const r = await this.tools.execute(conversation.userId, tool, args, conversation.id);
    const pending = r.actions.filter((a) => a.confirmationRequired);
    return {
      summary: r.summary,
      result: r.data,
      ...(pending.length ? { note: 'A confirmation card has been shown to the user. Do not claim the change is done; tell the user to confirm it.' } : {}),
    };
  }

  async contextForSession(sessionId: string) {
    const conversation = await this.prisma.agentConversation.findUnique({ where: { id: sessionId } });
    if (!conversation) throw notFound('Session');
    return this.contextBuilder.build(conversation.userId);
  }

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  async conversations(userId: string): Promise<AgentConversationView[]> {
    const rows = await this.prisma.agentConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: { _count: { select: { messages: true } } },
    });
    return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString(), messageCount: r._count.messages }));
  }

  async messages(userId: string, conversationId: string): Promise<AgentMessageView[]> {
    const conversation = await this.prisma.agentConversation.findFirst({ where: { id: conversationId, userId } });
    if (!conversation) throw notFound('Conversation');
    const [messages, actions] = await Promise.all([
      this.prisma.agentMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.agentAction.findMany({ where: { conversationId, status: { not: 'EXECUTED' }, type: { not: 'TOOL_CALL' } } }),
    ]);
    return messages.map((m) => {
      const meta = (m.metadata ?? {}) as { engine?: AgentEngine; toolCalls?: ToolCallView[] };
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        engine: meta.engine ?? null,
        toolCalls: meta.toolCalls ?? [],
        actions: actions.filter((a) => a.messageId === m.id).map(toActionView),
        createdAt: m.createdAt.toISOString(),
      };
    });
  }

  async auditLog(userId: string) {
    const rows = await this.prisma.agentAction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map(toActionView);
  }
}
