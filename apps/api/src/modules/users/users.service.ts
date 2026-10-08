import { Global, Injectable, Module } from '@nestjs/common';
import { ActivityType, AuthProvider, Prisma, type User } from '@prisma/client';
import { levelFromXp, type OrbitLevel, type SessionUser } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { notFound } from '../../common/http/errors';
import type { VerifiedClaims } from '../auth/token.service';

const CACHE_TTL_MS = 60_000;

export interface XpAward {
  type: ActivityType;
  title: string;
  description?: string;
  xp: number;
  metadata?: Prisma.InputJsonValue;
}

export interface XpResult {
  xpGained: number;
  level: OrbitLevel;
  leveledUp: boolean;
}

@Injectable()
export class UsersService {
  private readonly cache = new Map<string, { user: User; expires: number }>();

  constructor(private readonly prisma: PrismaService) {}

  /** Map verified JWT claims to an Orbit user, creating it on first Supabase sign-in. */
  async resolveFromClaims(claims: VerifiedClaims): Promise<User> {
    const cached = this.cache.get(claims.sub);
    if (cached && cached.expires > Date.now()) return cached.user;

    let user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user && claims.provider === 'SUPABASE') {
      user = await this.prisma.user.upsert({
        where: { email: claims.email },
        update: {},
        create: {
          id: claims.sub,
          email: claims.email,
          name: claims.name ?? claims.email.split('@')[0],
          authProvider: AuthProvider.SUPABASE,
        },
      });
    }
    if (!user) throw notFound('Account');

    // Track activity at most once per cache window.
    void this.prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch(() => undefined);
    this.cache.set(claims.sub, { user, expires: Date.now() + CACHE_TTL_MS });
    return user;
  }

  invalidate(userId: string) {
    this.cache.delete(userId);
  }

  async getById(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('Account');
    return user;
  }

  toSessionUser(user: Pick<User, 'id' | 'email' | 'name' | 'avatarUrl'>): SessionUser {
    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  }

  /** Record a meaningful action in the activity log and grant XP. */
  async award(userId: string, award: XpAward): Promise<XpResult> {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } });
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { xp: { increment: award.xp } } }),
      this.prisma.activityLog.create({
        data: {
          userId,
          type: award.type,
          title: award.title,
          description: award.description,
          xp: award.xp,
          metadata: award.metadata ?? {},
        },
      }),
    ]);
    this.invalidate(userId);
    const prevLevel = levelFromXp(before.xp).level;
    const level = levelFromXp(updated.xp);
    return { xpGained: award.xp, level, leveledUp: level.level > prevLevel };
  }

  /** Remove XP previously granted (e.g. when a task is un-checked). Never below zero. */
  async revokeXp(userId: string, xp: number): Promise<OrbitLevel> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } });
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { xp: Math.max(0, user.xp - xp) },
    });
    this.invalidate(userId);
    return levelFromXp(updated.xp);
  }

  async level(userId: string): Promise<OrbitLevel> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } });
    return levelFromXp(user.xp);
  }
}

@Global()
@Module({ providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
