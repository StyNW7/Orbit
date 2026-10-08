import { HttpException, HttpStatus } from '@nestjs/common';

/** Domain error with a stable machine-readable code and a safe user-facing message. */
export class AppError extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly retryable = false,
    readonly details?: unknown,
  ) {
    super({ code, message, retryable, details }, status);
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', `${what} not found.`, HttpStatus.NOT_FOUND);

export const forbidden = (message = 'You do not have access to this resource.') =>
  new AppError('FORBIDDEN', message, HttpStatus.FORBIDDEN);

export const badRequest = (message: string, details?: unknown) =>
  new AppError('BAD_REQUEST', message, HttpStatus.BAD_REQUEST, false, details);

export const unavailable = (code: string, message: string) =>
  new AppError(code, message, HttpStatus.SERVICE_UNAVAILABLE, true);
