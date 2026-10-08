import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'orbit:is-public';
/** Route does not require a user session. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/** Injects the authenticated user resolved by the global AuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as AuthUser;
});
