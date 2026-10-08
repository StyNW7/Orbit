import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Module, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Throttle } from '@nestjs/throttler';
import { AuthProvider } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { AuthConfig, AuthResult, MeResponse } from '@orbit/shared';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/errors';
import { CurrentUser, Public, type AuthUser } from '../../common/auth/auth.decorators';
import { UsersService } from '../users/users.service';
import { AuthGuard } from './auth.guard';
import { TokenService } from './token.service';

export const DEMO_EMAIL = 'demo@orbit.app';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SignUpDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters.' })
  @MaxLength(80)
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(128)
  password!: string;
}

export class SignInDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Password is required.' })
  password!: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly config: AppConfig,
  ) {}

  async config_(): Promise<AuthConfig> {
    const demo = await this.prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
    return { provider: this.config.supabaseEnabled ? 'supabase' : 'local', demoAvailable: Boolean(demo) };
  }

  private assertLocal() {
    if (this.config.supabaseEnabled) {
      throw new AppError('USE_SUPABASE_AUTH', 'This deployment uses Supabase Auth. Sign in from the Orbit web app.');
    }
  }

  async signUp(dto: SignUpDto): Promise<AuthResult> {
    this.assertLocal();
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new AppError('EMAIL_IN_USE', 'An account with this email already exists.', HttpStatus.CONFLICT);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        authProvider: AuthProvider.LOCAL,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });
    return { accessToken: await this.tokens.signLocal(user), user: this.users.toSessionUser(user) };
  }

  async signIn(dto: SignInDto): Promise<AuthResult> {
    this.assertLocal();
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = user?.passwordHash ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.', HttpStatus.UNAUTHORIZED);
    }
    return { accessToken: await this.tokens.signLocal(user), user: this.users.toSessionUser(user) };
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.users.getById(userId);
    const [profile, goal] = await Promise.all([
      this.prisma.careerProfile.findUnique({ where: { userId }, select: { onboardingCompleted: true } }),
      this.prisma.careerGoal.findFirst({
        where: { userId, isPrimary: true, status: 'ACTIVE' },
        include: { role: { select: { slug: true, title: true } } },
      }),
    ]);
    return {
      user: this.users.toSessionUser(user),
      onboardingCompleted: profile?.onboardingCompleted ?? false,
      primaryRole: goal ? { slug: goal.role.slug, title: goal.role.title } : null,
    };
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('config')
  config() {
    return this.auth.config_();
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('signup')
  signUp(@Body() dto: SignUpDto) {
    return this.auth.signUp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('signin')
  signIn(@Body() dto: SignInDto) {
    return this.auth.signIn(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [TokenService],
})
export class AuthModule {}
