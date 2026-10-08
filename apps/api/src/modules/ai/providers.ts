import { randomUUID } from 'node:crypto';
import {
  AiUnavailableError,
  type AiProvider,
  type ChatMessage,
  type ChatOptions,
  type ChatResult,
  type ToolCall,
} from './ai.types';

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new AiUnavailableError(`AI provider responded ${res.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    const msg = (error as Error).name === 'AbortError' ? 'AI provider timed out' : (error as Error).message;
    throw new AiUnavailableError(msg);
  } finally {
    clearTimeout(timer);
  }
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

/** OpenAI-compatible message shape (Groq, watsonx chat). */
function toOpenAiMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === 'tool') return { role: 'tool', content: m.content, tool_call_id: m.toolCallId };
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || '',
        tool_calls: m.toolCalls.map((t) => ({
          id: t.id,
          type: 'function',
          function: { name: t.name, arguments: JSON.stringify(t.arguments) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

function fromOpenAiMessage(message: any): ChatResult {
  const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((t: any) => ({
    id: t.id ?? randomUUID(),
    name: t.function?.name,
    arguments: parseArgs(t.function?.arguments),
  }));
  return { content: message?.content ?? '', toolCalls };
}

// ---------------------------------------------------------------------------
// Ollama (local, zero API cost) — default
// ---------------------------------------------------------------------------

export class OllamaProvider implements AiProvider {
  readonly name = 'ollama';
  constructor(
    readonly model: string,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const tags = await fetchJson(`${this.baseUrl}/api/tags`, { method: 'GET' }, 3000);
      const names: string[] = (tags.models ?? []).map((m: any) => m.name);
      return names.some((n) => n === this.model || n.split(':')[0] === this.model || n === `${this.model}:latest`);
    } catch {
      return false;
    }
  }

  /** Measure local throughput so Orbit can skip requests the hardware cannot finish in time. */
  async benchmark(): Promise<{ promptTps: number; evalTps: number }> {
    const data = await fetchJson(
      `${this.baseUrl}/api/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: 'In one sentence, explain why measurable goals help people grow their careers.',
          stream: false,
          options: { num_predict: 32 },
        }),
      },
      120_000,
    );
    const rate = (count: number, ns: number) => (count && ns ? count / (ns / 1e9) : 0);
    return { promptTps: rate(data.prompt_eval_count, data.prompt_eval_duration), evalTps: rate(data.eval_count, data.eval_duration) };
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      stream: false,
      messages: messages.map((m) => {
        if (m.role === 'assistant' && m.toolCalls?.length) {
          return {
            role: 'assistant',
            content: m.content || '',
            tool_calls: m.toolCalls.map((t) => ({ function: { name: t.name, arguments: t.arguments } })),
          };
        }
        return { role: m.role, content: m.content, ...(m.role === 'tool' && m.name ? { tool_name: m.name } : {}) };
      }),
      options: { temperature: options.temperature ?? 0.3, num_predict: options.maxTokens ?? 900 },
    };
    if (options.json) body.format = 'json';
    if (options.tools?.length) {
      body.tools = options.tools.map((t) => ({ type: 'function', function: t }));
    }
    const data = await fetchJson(
      `${this.baseUrl}/api/chat`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      options.timeoutMs ?? this.timeoutMs,
    );
    const toolCalls: ToolCall[] = (data.message?.tool_calls ?? []).map((t: any) => ({
      id: randomUUID(),
      name: t.function?.name,
      arguments: parseArgs(t.function?.arguments),
    }));
    return { content: data.message?.content ?? '', toolCalls };
  }
}

// ---------------------------------------------------------------------------
// Groq (hosted fallback for fast demos)
// ---------------------------------------------------------------------------

export class GroqProvider implements AiProvider {
  readonly name = 'groq';
  constructor(
    readonly model: string,
    private readonly apiKey: string | undefined,
    private readonly timeoutMs: number,
  ) {}

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await fetchJson('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${this.apiKey}` } }, 4000);
      return true;
    } catch {
      return false;
    }
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    if (!this.apiKey) throw new AiUnavailableError('GROQ_API_KEY is not configured');
    const body: Record<string, unknown> = {
      model: this.model,
      messages: toOpenAiMessages(messages),
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 900,
    };
    if (options.json) body.response_format = { type: 'json_object' };
    if (options.tools?.length) {
      body.tools = options.tools.map((t) => ({ type: 'function', function: t }));
      body.tool_choice = 'auto';
    }
    const data = await fetchJson(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
      },
      options.timeoutMs ?? this.timeoutMs,
    );
    return fromOpenAiMessage(data.choices?.[0]?.message);
  }
}

// ---------------------------------------------------------------------------
// IBM watsonx.ai (Granite models)
// ---------------------------------------------------------------------------

export class WatsonxProvider implements AiProvider {
  readonly name = 'watsonx';
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    readonly model: string,
    private readonly apiKey: string | undefined,
    private readonly projectId: string | undefined,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  private async accessToken(): Promise<string> {
    if (!this.apiKey) throw new AiUnavailableError('WATSONX_API_KEY is not configured');
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const data = await fetchJson(
      'https://iam.cloud.ibm.com/identity/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ grant_type: 'urn:ibm:params:oauth:grant-type:apikey', apikey: this.apiKey }).toString(),
      },
      10_000,
    );
    this.token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey || !this.projectId) return false;
    try {
      await this.accessToken();
      return true;
    } catch {
      return false;
    }
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const token = await this.accessToken();
    const body: Record<string, unknown> = {
      model_id: this.model,
      project_id: this.projectId,
      messages: toOpenAiMessages(messages),
      max_tokens: options.maxTokens ?? 900,
      temperature: options.temperature ?? 0.3,
    };
    if (options.tools?.length) body.tools = options.tools.map((t) => ({ type: 'function', function: t }));
    if (options.json) body.response_format = { type: 'json_object' };
    const data = await fetchJson(
      `${this.baseUrl}/ml/v1/text/chat?version=2024-10-08`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: JSON.stringify(body),
      },
      options.timeoutMs ?? this.timeoutMs,
    );
    return fromOpenAiMessage(data.choices?.[0]?.message);
  }
}

export class NoopProvider implements AiProvider {
  readonly name = 'none';
  readonly model = 'none';
  async isAvailable() {
    return false;
  }
  async chat(): Promise<ChatResult> {
    throw new AiUnavailableError('No AI provider configured (AI_PROVIDER=none)');
  }
}
