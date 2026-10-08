import type { ApiResponse } from '@orbit/shared';
import { getAccessToken, handleUnauthorized } from './auth';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable = false,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

async function request<T>(method: string, path: string, body?: Body, signal?: AbortSignal): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError('NETWORK_ERROR', 'Orbit cannot reach the server. Check your connection and try again.', 0, true);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (res.status === 401 && token) {
    handleUnauthorized();
  }
  if (!res.ok || !payload || payload.success === false) {
    const err = payload && payload.success === false ? payload.error : null;
    throw new ApiError(
      err?.code ?? 'REQUEST_FAILED',
      err?.message ?? 'Something went wrong. Please try again.',
      res.status,
      err?.retryable ?? res.status >= 500,
      err?.details,
    );
  }
  return payload.data;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal),
  post: <T>(path: string, body: Body = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: Body = {}) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, file: File, field = 'file') => {
    const form = new FormData();
    form.append(field, file);
    return request<T>('POST', path, form);
  },
  /** Authenticated binary download (files are private). */
  async blob(path: string): Promise<Blob> {
    const token = await getAccessToken();
    const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new ApiError('DOWNLOAD_FAILED', 'Could not open this file.', res.status);
    return res.blob();
  },
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
