import { HttpStatus, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AppError } from '../../common/http/errors';
import type { UsersService } from '../users/users.service';
import { AuthGuard } from './auth.guard';
import type { TokenService } from './token.service';

function context(headers: Record<string, string>) {
  const req: { headers: Record<string, string>; user?: unknown } = { headers };
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

function guard({ isPublic = false, verify = jest.fn(), resolve = jest.fn() } = {}) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) } as unknown as Reflector;
  const tokens = { verify } as unknown as TokenService;
  const users = { resolveFromClaims: resolve } as unknown as UsersService;
  return new AuthGuard(reflector, tokens, users);
}

async function expectUnauthorized(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
}

describe('AuthGuard', () => {
  it('lets @Public() routes through without a token', async () => {
    const verify = jest.fn();
    await expect(guard({ isPublic: true, verify }).canActivate(context({}).ctx)).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects requests without a bearer token', async () => {
    await expectUnauthorized(guard().canActivate(context({}).ctx));
    await expectUnauthorized(guard().canActivate(context({ authorization: 'Basic abc' }).ctx));
    await expectUnauthorized(guard().canActivate(context({ authorization: 'Bearer' }).ctx));
  });

  it('propagates token verification failures', async () => {
    const verify = jest.fn().mockRejectedValue(new AppError('INVALID_TOKEN', 'Session expired.', HttpStatus.UNAUTHORIZED));
    await expectUnauthorized(guard({ verify }).canActivate(context({ authorization: 'Bearer bad' }).ctx));
  });

  it('verifies the token and attaches the resolved Orbit user to the request', async () => {
    const verify = jest.fn().mockResolvedValue({ sub: 'abc', email: 'stanley@example.com' });
    const resolve = jest.fn().mockResolvedValue({ id: 'u1', email: 'stanley@example.com', name: 'Stanley Wijaya' });
    const { ctx, req } = context({ authorization: 'Bearer good-token' });
    await expect(guard({ verify, resolve }).canActivate(ctx)).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('good-token');
    expect(req.user).toEqual({ id: 'u1', email: 'stanley@example.com', name: 'Stanley Wijaya' });
  });
});
