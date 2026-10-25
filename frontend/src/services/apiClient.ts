import type { ApiErrorEnvelope } from '../types/api';

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly requestId: string | null;

  constructor(message: string, code: string, status: number | null, requestId: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const error = value.error;
  return !!error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    && 'message' in error && typeof error.message === 'string'
    && 'request_id' in value && typeof value.request_id === 'string';
}

export function createApiClient(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('The API base URL must be an HTTP(S) URL without credentials, query or fragment.');
  }
  const base = url.href.replace(/\/+$/, '');

  return {
    async request<T>(path: string, options: RequestInit = {}): Promise<T> {
      if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Use an API-relative path beginning with /.');
      const headers = new Headers(options.headers);
      if (!headers.has('Accept')) headers.set('Accept', 'application/json');
      let response: Response;
      try {
        response = await fetch(`${base}${path}`, { ...options, headers });
      } catch (error) {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') throw error;
        throw new ApiError('Unable to reach TraceSync. Check that the backend is running.', 'NETWORK_ERROR', null);
      }
      if (response.ok && response.status === 204) return undefined as T;
      const payload: unknown = await response.json().catch(() => undefined);
      const requestId = response.headers.get('X-Request-ID') ?? (isErrorEnvelope(payload) ? payload.request_id : null);
      if (!response.ok) {
        throw new ApiError(
          isErrorEnvelope(payload) ? payload.error.message : 'The request could not be completed.',
          isErrorEnvelope(payload) ? payload.error.code : 'HTTP_ERROR', response.status, requestId,
        );
      }
      if (payload === undefined) throw new ApiError('The server returned an unexpected response.', 'INVALID_RESPONSE', response.status, requestId);
      return payload as T;
    },
  };
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000/api/v1';
// No requests run on import or while rendering the application shell.
export const apiClient = createApiClient(API_BASE_URL);
