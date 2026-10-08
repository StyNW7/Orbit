import { HttpStatus, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { AppConfig } from '../../config/app-config';
import { AppError } from '../../common/http/errors';

export interface VerifiedClaims {
  sub: string;
  email: string;
  name: string | null;
  provider: 'SUPABASE' | 'LOCAL';
}

const LOCAL_ISSUER = 'orbit-api';
const LOCAL_AUDIENCE = 'orbit-web';

@Injectable()
export class TokenService {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly config: AppConfig) {}

  private get localSecret() {
    return new TextEncoder().encode(this.config.env.APP_JWT_SECRET);
  }

  async signLocal(user: { id: string; email: string; name: string }): Promise<string> {
    return new SignJWT({ email: user.email, name: user.name })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(LOCAL_ISSUER)
      .setAudience(LOCAL_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(this.localSecret);
  }

  async verify(token: string): Promise<VerifiedClaims> {
    try {
      if (this.config.supabaseEnabled) return await this.verifySupabase(token);
      const { payload } = await jwtVerify(token, this.localSecret, { issuer: LOCAL_ISSUER, audience: LOCAL_AUDIENCE });
      return this.toClaims(payload, 'LOCAL');
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('INVALID_SESSION', 'Your session has expired. Please sign in again.', HttpStatus.UNAUTHORIZED);
    }
  }

  private async verifySupabase(token: string): Promise<VerifiedClaims> {
    const env = this.config.env;
    if (env.SUPABASE_JWT_SECRET) {
      // Legacy HS256 projects
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(env.SUPABASE_JWT_SECRET), {
          audience: 'authenticated',
        });
        return this.toClaims(payload, 'SUPABASE');
      } catch {
        // fall through to JWKS (asymmetric signing keys)
      }
    }
    this.jwks ??= createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, this.jwks, { audience: 'authenticated' });
    return this.toClaims(payload, 'SUPABASE');
  }

  private toClaims(payload: JWTPayload, provider: 'SUPABASE' | 'LOCAL'): VerifiedClaims {
    const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
    const email = (payload.email as string) ?? '';
    if (!payload.sub || !email) {
      throw new AppError('INVALID_SESSION', 'Your session is missing required claims.', HttpStatus.UNAUTHORIZED);
    }
    const name = (payload.name as string) ?? (meta.full_name as string) ?? (meta.name as string) ?? null;
    return { sub: payload.sub, email, name, provider };
  }
}
