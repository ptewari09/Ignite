export const TEST_API = 'http://127.0.0.1:8001/api/v1';

export function testApiUrl(target: string): string {
  const url = new URL(target, `${TEST_API}/`);
  if (url.origin !== 'http://127.0.0.1:8001' || url.username || url.password
    || (url.pathname !== '/api/v1' && !url.pathname.startsWith('/api/v1/'))) {
    throw new Error('Browser tests may request only the test API on 127.0.0.1:8001; the normal workspace is blocked.');
  }
  return url.href;
}
