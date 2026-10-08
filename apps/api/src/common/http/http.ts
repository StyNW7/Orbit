import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';

export const RAW_RESPONSE = 'orbit:raw-response';
/** Skip the `{ success, data }` envelope (e.g. for health probes). */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [context.getHandler(), context.getClass()]);
    if (raw) return next.handle();
    return next.handle().pipe(map((data) => ({ success: true, data: data ?? null })));
  }
}

/** Normalises every error into `{ success: false, error }` and never leaks stack traces. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong on our side. Please try again.';
    let retryable = true;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        code = (b.code as string) ?? defaultCode(status);
        const rawMessage = b.message;
        message = Array.isArray(rawMessage) ? rawMessage.join('. ') : ((rawMessage as string) ?? exception.message);
        retryable = (b.retryable as boolean) ?? status >= 500;
        details = b.details;
        if (Array.isArray(rawMessage)) {
          code = 'VALIDATION_ERROR';
          details = rawMessage;
        }
      } else {
        code = defaultCode(status);
        message = String(body);
        retryable = status >= 500;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        message = 'This item already exists.';
        retryable = false;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'The requested item was not found.';
        retryable = false;
      } else {
        code = 'DATABASE_ERROR';
        message = 'We could not complete this request because of a database problem.';
      }
      this.logger.warn(`${req.method} ${req.url} → Prisma ${exception.code}`);
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = 'DATABASE_UNAVAILABLE';
      message = 'Orbit cannot reach its database right now. Please try again shortly.';
    }

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${status} ${code}`, (exception as Error)?.stack);
    }

    res.status(status).json({ success: false, error: { code, message, retryable, details } });
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
  }
}
