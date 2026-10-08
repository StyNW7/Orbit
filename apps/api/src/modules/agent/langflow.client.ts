import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';

const HEALTH_TTL_MS = 30_000;

/**
 * Thin client for Langflow's stable run endpoint:  POST /api/v1/run/{flowId}
 * Only the API talks to Langflow — the browser never does.
 */
@Injectable()
export class LangflowClient {
  private readonly logger = new Logger('Langflow');
  private health: { ok: boolean; at: number } | null = null;

  constructor(private readonly config: AppConfig) {}

  get configured(): boolean {
    return this.config.langflowConfigured;
  }

  get flowId(): string | null {
    return this.config.env.LANGFLOW_FLOW_ID ?? null;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (this.config.env.LANGFLOW_API_KEY) h['x-api-key'] = this.config.env.LANGFLOW_API_KEY;
    return h;
  }

  async isReachable(force = false): Promise<boolean> {
    if (!this.configured) return false;
    if (!force && this.health && Date.now() - this.health.at < HEALTH_TTL_MS) return this.health.ok;
    let ok = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.config.env.LANGFLOW_BASE_URL}/health`, { signal: controller.signal });
      clearTimeout(timer);
      ok = res.ok;
    } catch {
      ok = false;
    }
    if (this.health?.ok !== ok) this.logger.log(`Langflow is ${ok ? 'reachable' : 'unreachable'}`);
    this.health = { ok, at: Date.now() };
    return ok;
  }

  /** Run the Orbit Agent flow. `sessionId` = Orbit conversation id (lets tools resolve the user). */
  async run(inputValue: string, sessionId: string): Promise<string> {
    const env = this.config.env;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.LANGFLOW_TIMEOUT_MS);
    try {
      const res = await fetch(`${env.LANGFLOW_BASE_URL}/api/v1/run/${env.LANGFLOW_FLOW_ID}?stream=false`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ input_value: inputValue, input_type: 'chat', output_type: 'chat', session_id: sessionId }),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Langflow responded ${res.status}: ${text.slice(0, 200)}`);
      const message = extractMessage(JSON.parse(text));
      if (!message) throw new Error('Langflow returned no message');
      return message;
    } catch (error) {
      this.health = { ok: false, at: Date.now() };
      throw new Error((error as Error).name === 'AbortError' ? 'Langflow timed out' : (error as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }
}

export function extractMessage(data: any): string | null {
  const out = data?.outputs?.[0]?.outputs?.[0];
  const candidates = [
    out?.results?.message?.text,
    out?.results?.message?.data?.text,
    out?.artifacts?.message,
    out?.messages?.[0]?.message,
    out?.outputs?.message?.message,
  ];
  const found = candidates.find((c) => typeof c === 'string' && c.trim().length > 0);
  return found ?? null;
}
