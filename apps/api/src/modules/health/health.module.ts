import { Controller, Get, Module } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/auth/auth.decorators';
import { RawResponse } from '../../common/http/http';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config';
import { AiService } from '../ai/ai.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @SkipThrottle()
  @RawResponse()
  @Get()
  async health() {
    let database = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      auth: this.config.supabaseEnabled ? 'supabase' : 'local',
      storage: this.config.supabaseStorageEnabled ? 'supabase' : 'local',
      ai: { provider: this.ai.provider.name, model: this.ai.provider.model, available: await this.ai.isAvailable() },
      langflow: { configured: this.config.langflowConfigured },
      time: new Date().toISOString(),
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
