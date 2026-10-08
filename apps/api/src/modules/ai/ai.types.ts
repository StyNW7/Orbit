export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** assistant tool calls (when role = assistant) */
  toolCalls?: ToolCall[];
  /** id of the call this message answers (when role = tool) */
  toolCallId?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatOptions {
  tools?: ToolDefinition[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** per-call timeout; defaults to AI_TIMEOUT_MS */
  timeoutMs?: number;
}

export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  isAvailable(): Promise<boolean>;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  /** Optional: measured tokens/second (local providers only). */
  benchmark?(): Promise<{ promptTps: number; evalTps: number }>;
}

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}
