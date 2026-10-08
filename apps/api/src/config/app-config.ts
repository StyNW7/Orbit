import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { z } from 'zod';
import type { ReadinessCategory } from '@orbit/shared';

const bool = z
  .string()
  .optional()
  .transform((v) => v === undefined || v === '' ? undefined : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()));

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length ? v.trim() : undefined));

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  API_PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  SUPABASE_URL: optionalString,
  SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_JWT_SECRET: optionalString,
  SUPABASE_STORAGE_BUCKET: z.string().default('orbit-files'),
  APP_JWT_SECRET: z.string().default('change-me-to-a-long-random-string'),

  LANGFLOW_BASE_URL: optionalString,
  LANGFLOW_FLOW_ID: optionalString,
  LANGFLOW_API_KEY: optionalString,
  LANGFLOW_TIMEOUT_MS: z.coerce.number().default(90000),
  ORBIT_TOOL_API_KEY: z.string().default('change-me-orbit-tool-key'),

  AI_PROVIDER: z.enum(['ollama', 'groq', 'watsonx', 'none']).default('ollama'),
  AI_MODEL: optionalString,
  AI_TIMEOUT_MS: z.coerce.number().default(60000),
  AGENT_TIMEOUT_MS: z.coerce.number().default(35000),
  // auto: native tool-calling for hosted models (groq, watsonx); grounded generation for local Ollama models
  AGENT_TOOL_CALLING: z.enum(['auto', 'on', 'off']).default('auto'),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  GROQ_API_KEY: optionalString,
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  WATSONX_API_KEY: optionalString,
  WATSONX_PROJECT_ID: optionalString,
  WATSONX_URL: z.string().default('https://us-south.ml.cloud.ibm.com'),
  WATSONX_MODEL: z.string().default('ibm/granite-3-8b-instruct'),

  EMBEDDING_PROVIDER: z.enum(['local', 'ollama']).default('local'),
  EMBEDDING_MODEL: z.string().default('nomic-embed-text'),

  ENABLE_EXTERNAL_PROVIDERS: bool,
  GOOGLE_BOOKS_API_KEY: optionalString,
  SEMANTIC_SCHOLAR_API_KEY: optionalString,
  OPENALEX_EMAIL: optionalString,

  READINESS_WEIGHTS: optionalString,
  NOTIFICATION_CRON: z.string().default('*/5 * * * *'),
});

export type Env = z.infer<typeof EnvSchema>;

@Injectable()
export class AppConfig {
  private readonly logger = new Logger('Config');
  readonly env: Env;

  constructor() {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Invalid environment configuration: ${issues}`);
    }
    this.env = parsed.data;
    if (this.isProduction && this.env.APP_JWT_SECRET.startsWith('change-me') && !this.supabaseEnabled) {
      this.logger.warn('APP_JWT_SECRET is using the default value. Set a strong secret before deploying.');
    }
  }

  get isProduction() {
    return this.env.NODE_ENV === 'production';
  }

  get supabaseEnabled(): boolean {
    return Boolean(this.env.SUPABASE_URL);
  }

  get supabaseStorageEnabled(): boolean {
    return Boolean(this.env.SUPABASE_URL && this.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  get langflowConfigured(): boolean {
    return Boolean(this.env.LANGFLOW_BASE_URL && this.env.LANGFLOW_FLOW_ID);
  }

  get externalProvidersEnabled(): boolean {
    return this.env.ENABLE_EXTERNAL_PROVIDERS ?? true;
  }

  get aiModel(): string {
    if (this.env.AI_MODEL) return this.env.AI_MODEL;
    switch (this.env.AI_PROVIDER) {
      case 'groq':
        return this.env.GROQ_MODEL;
      case 'watsonx':
        return this.env.WATSONX_MODEL;
      case 'ollama':
        return 'granite3.3:2b';
      default:
        return 'none';
    }
  }

  /** Whether the direct engine lets the model choose tools itself (vs. grounded generation). */
  get agentNativeToolCalling(): boolean {
    const mode = this.env.AGENT_TOOL_CALLING;
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return this.env.AI_PROVIDER === 'groq' || this.env.AI_PROVIDER === 'watsonx';
  }

  get readinessWeights(): Partial<Record<ReadinessCategory, number>> | undefined {
    if (!this.env.READINESS_WEIGHTS) return undefined;
    try {
      const raw = JSON.parse(this.env.READINESS_WEIGHTS) as Record<string, number>;
      const map: Record<string, ReadinessCategory> = {
        skill: 'SKILL',
        experience: 'EXPERIENCE',
        portfolio: 'PORTFOLIO',
        knowledge: 'KNOWLEDGE',
        application: 'APPLICATION',
        interview: 'INTERVIEW',
      };
      const out: Partial<Record<ReadinessCategory, number>> = {};
      for (const [k, v] of Object.entries(raw)) {
        const cat = map[k.toLowerCase()] ?? (k.toUpperCase() as ReadinessCategory);
        if (typeof v === 'number') out[cat] = v;
      }
      return out;
    } catch {
      this.logger.warn('READINESS_WEIGHTS is not valid JSON — using defaults.');
      return undefined;
    }
  }
}

@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
export class AppConfigModule {}
