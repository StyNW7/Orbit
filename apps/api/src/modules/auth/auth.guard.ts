import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC, type AuthUser } from '../../common/auth/auth.decorators';
import { AppError } from '../../common/http/errors';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';

/**
 * Global guard: verifies the bearer JWT (Supabase or local) and resolves the
 * Orbit user. Every service then filters data by `req.user.id`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new AppError('UNAUTHORIZED', 'Please sign in to continue.', HttpStatus.UNAUTHORIZED);
    }
    const claims = await this.tokens.verify(token);
    const user = await this.users.resolveFromClaims(claims);
    req.user = { id: user.id, email: user.email, name: user.name };
    return true;
  }
}
