import { describe, expect, it } from 'vitest';
import { testApiUrl } from './support/testNetworkPolicy';

describe('Browser test network isolation', () => {
  it('allows the dedicated test API and resolves API-relative paths', () => {
    expect(testApiUrl('projects')).toBe('http://127.0.0.1:8001/api/v1/projects');
    expect(testApiUrl('/api/v1/projects')).toBe('http://127.0.0.1:8001/api/v1/projects');
  });

  it.each([
    'http://127.0.0.1:8000/api/v1/projects',
    'http://localhost:8000/api/v1/projects',
    'https://example.invalid/api/v1/projects',
    'http://127.0.0.1:8001/other-path',
    'http://user:password@127.0.0.1:8001/api/v1/projects',
  ])('blocks an unsafe target before any HTTP request: %s', (url) => {
    expect(() => testApiUrl(url)).toThrow('normal workspace is blocked');
  });
});
