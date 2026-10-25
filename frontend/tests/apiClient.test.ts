import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../src/services/apiClient';

const client = createApiClient('http://127.0.0.1:8000/api/v1/');
afterEach(() => vi.unstubAllGlobals());

describe('API client foundation', () => {
  it('uses the configured base URL and returns typed JSON without forcing a content type', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'healthy' })));
    vi.stubGlobal('fetch', fetch);
    const result = await client.request<{ status: string }>('/health');
    expect(result.status).toBe('healthy');
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:8000/api/v1/health');
    const options = fetch.mock.calls[0][1] as RequestInit;
    expect(new Headers(options.headers).get('Accept')).toBe('application/json');
    expect(new Headers(options.headers).has('Content-Type')).toBe(false);
  });

  it('preserves backend error code, status, safe message and request ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'WORKBOOK_ROLE_OCCUPIED', message: 'This role is occupied.' }, request_id: 'request-123',
    }), { status: 409, headers: { 'X-Request-ID': 'request-123' } })));
    await expect(client.request('/example')).rejects.toMatchObject({
      name: 'ApiError', code: 'WORKBOOK_ROLE_OCCUPIED', message: 'This role is occupied.', status: 409, requestId: 'request-123',
    });
  });

  it('falls back to the envelope request ID when the header is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.' }, request_id: 'envelope-id',
    }), { status: 422 })));
    await expect(client.request('/example')).rejects.toMatchObject({ requestId: 'envelope-id', status: 422 });
  });

  it('turns network failures into a consistent API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(client.request('/example')).rejects.toBeInstanceOf(ApiError);
    await expect(client.request('/example')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: null });
  });

  it('preserves request cancellation', async () => {
    const cancellation = new DOMException('Cancelled', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(cancellation));
    await expect(client.request('/example')).rejects.toBe(cancellation);
  });

  it('hides unexpected HTML error bodies and rejects malformed successful JSON', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('<html>Internal details</html>', { status: 502 }))
      .mockResolvedValueOnce(new Response('not JSON', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await expect(client.request('/example')).rejects.toMatchObject({ code: 'HTTP_ERROR', message: 'The request could not be completed.', status: 502 });
    await expect(client.request('/example')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('handles an empty HTTP 204 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(client.request<void>('/example')).resolves.toBeUndefined();
  });

  it('rejects credential-bearing configuration and external request paths', async () => {
    expect(() => createApiClient('https://user:secret@example.test/api/v1')).toThrow();
    await expect(client.request('https://example.test')).rejects.toThrow('API-relative path');
    await expect(client.request('//example.test')).rejects.toThrow('API-relative path');
  });
});
