import { Global, Injectable, Logger, Module } from '@nestjs/common';
import type { z, ZodTypeAny } from 'zod';
import { AppConfig } from '../../config/app-config';
import { AiUnavailableError, type AiProvider, type ChatMessage, type ChatOptions, type ChatResult } from './ai.types';
import { GroqProvider, NoopProvider, OllamaProvider, WatsonxProvider } from './providers';
import { EmbeddingService } from './embedding.service';

const AVAILABILITY_TTL_MS = 30_000;
const COOLDOWN_MS = 3 * 60_000;
const BENCHMARK_TTL_MS = 15 * 60_000;

/**
 * Single AI gateway for the API. Business logic never talks to a provider
 * directly — switch providers with AI_PROVIDER / AI_MODEL only.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger('AI');
  readonly provider: AiProvider;
  private availability: { value: boolean; at: number } | null = null;
  private cooldownUntil = 0;
  private perf: { promptTps: number; evalTps: number; at: number } | null = null;
  private benchmarking = false;
  lastLatencyMs: number | null = null;

  constructor(config: AppConfig) {
    const env = config.env;
    const model = config.aiModel;
    switch (env.AI_PROVIDER) {
      case 'ollama':
        this.provider = new OllamaProvider(model, env.OLLAMA_BASE_URL, env.AI_TIMEOUT_MS);
        break;
      case 'groq':
        this.provider = new GroqProvider(model, env.GROQ_API_KEY, env.AI_TIMEOUT_MS);
        break;
      case 'watsonx':
        this.provider = new WatsonxProvider(model, env.WATSONX_API_KEY, env.WATSONX_PROJECT_ID, env.WATSONX_URL, env.AI_TIMEOUT_MS);
        break;
      default:
        this.provider = new NoopProvider();
    }
  }

  async isAvailable(force = false): Promise<boolean> {
    if (this.coolingDown) return false;
    if (!force && this.availability && Date.now() - this.availability.at < AVAILABILITY_TTL_MS) {
      return this.availability.value;
    }
    const value = await this.provider.isAvailable().catch(() => false);
    if (this.availability?.value !== value) {
      this.logger.log(`${this.provider.name}:${this.provider.model} is ${value ? 'available' : 'unavailable'}`);
    }
    this.availability = { value, at: Date.now() };
    if (value) void this.measure();
    return value;
  }

  /** True while the provider is cooling down after a timeout (keeps the UI fast on slow hardware). */
  get coolingDown(): boolean {
    return this.cooldownUntil > Date.now();
  }

  /** Measured throughput of local models (null for hosted providers or before the first benchmark). */
  get throughput(): { promptTps: number; evalTps: number } | null {
    return this.perf ? { promptTps: Math.round(this.perf.promptTps), evalTps: Math.round(this.perf.evalTps * 10) / 10 } : null;
  }

  private async measure() {
    if (!this.provider.benchmark || this.benchmarking) return;
    if (this.perf && Date.now() - this.perf.at < BENCHMARK_TTL_MS) return;
    this.benchmarking = true;
    try {
      const r = await this.provider.benchmark();
      this.perf = { ...r, at: Date.now() };
      this.logger.log(`${this.provider.model} throughput: ${r.evalTps.toFixed(1)} tok/s generation, ${r.promptTps.toFixed(0)} tok/s prompt`);
    } catch {
      // benchmark is best-effort
    } finally {
      this.benchmarking = false;
    }
  }

  /** Rough estimate of whether a request can finish within its time budget on this hardware. */
  canFinish(messages: ChatMessage[], maxTokens: number, timeoutMs: number): boolean {
    if (!this.perf || this.perf.evalTps <= 0 || this.perf.promptTps <= 0) return true;
    const promptTokens = messages.reduce((n, m) => n + m.content.length, 0) / 4;
    const expectedOutput = Math.min(maxTokens, 350);
    const seconds = promptTokens / this.perf.promptTps + expectedOutput / this.perf.evalTps;
    return seconds * 1000 < timeoutMs;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const budget = options?.timeoutMs;
    if (budget && !this.canFinish(messages, options?.maxTokens ?? 900, budget)) {
      throw new AiUnavailableError('Model is too slow for this request on the current hardware');
    }
    const started = Date.now();
    try {
      const result = await this.provider.chat(messages, options);
      this.lastLatencyMs = Date.now() - started;
      return result;
    } catch (error) {
      const message = (error as Error).message;
      if (/timed out/i.test(message)) {
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.logger.warn(`${this.provider.name} timed out — using deterministic fallbacks for ${COOLDOWN_MS / 60000} min`);
      } else {
        this.availability = { value: false, at: Date.now() };
      }
      throw error instanceof AiUnavailableError ? error : new AiUnavailableError(message);
    }
  }

  /** Ask for JSON and validate it. Returns null instead of trusting invalid model output. */
  async generateJson<S extends ZodTypeAny>(
    system: string,
    user: string,
    schema: S,
    maxTokens = 1500,
    timeoutMs?: number,
  ): Promise<z.infer<S> | null> {
    if (!(await this.isAvailable())) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await this.chat(
          [
            { role: 'system', content: `${system}\nRespond with a single valid JSON object only.` },
            { role: 'user', content: user },
          ],
          { json: true, temperature: 0.1, maxTokens, timeoutMs },
        );
        const parsed = schema.safeParse(extractJson(result.content));
        if (parsed.success) return parsed.data;
        this.logger.warn(`AI JSON failed validation (attempt ${attempt + 1}): ${parsed.error.issues[0]?.message}`);
      } catch (error) {
        this.logger.warn(`AI JSON generation failed: ${(error as Error).message}`);
        return null;
      }
    }
    return null;
  }

  /** Short natural-language text, or null when no model is reachable in time. */
  async generateText(system: string, user: string, maxTokens = 400, timeoutMs = 15_000): Promise<string | null> {
    if (!(await this.isAvailable())) return null;
    try {
      const result = await this.chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        { temperature: 0.4, maxTokens, timeoutMs },
      );
      return result.content.trim() || null;
    } catch (error) {
      this.logger.warn(`AI text generation failed: ${(error as Error).message}`);
      return null;
    }
  }
}

export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

@Global()
@Module({ providers: [AiService, EmbeddingService], exports: [AiService, EmbeddingService] })
export class AiModule {}
