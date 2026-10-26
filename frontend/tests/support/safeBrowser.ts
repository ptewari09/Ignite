import { expect, test as base } from '@playwright/test';
import { testApiUrl } from './testNetworkPolicy';

export const test = base.extend<{ apiIsolation: void }>({
  apiIsolation: [async ({ context }, use, testInfo) => {
    // Page-level fictional mocks take precedence. Any real API request that
    // reaches the network must stay on the dedicated test API, never port 8000.
    await context.route('**/api/v1/**', async (route) => {
      try { testApiUrl(route.request().url()); }
      catch (error) { await route.abort('blockedbyclient'); throw error; }
      if (!testInfo.config.metadata.acceptanceRunId) {
        await route.abort('blockedbyclient');
        throw new Error('Controlled browser tests require mocked API responses.');
      }
      await route.continue();
    });
    await use();
  }, { auto: true }],
  request: async ({ request }, use, testInfo) => {
    const networkMethods = new Set(['fetch', 'get', 'post', 'put', 'patch', 'delete', 'head']);
    const guarded = new Proxy(request, {
      get(target, property) {
        const value = Reflect.get(target, property);
        if (typeof value !== 'function') return value;
        if (!networkMethods.has(String(property))) return value.bind(target);
        return (input: string | { url: () => string }, ...args: unknown[]) => {
          const url = testApiUrl(typeof input === 'string' ? input : input.url());
          if (!testInfo.config.metadata.acceptanceRunId) throw new Error('Controlled browser tests require mocked API responses.');
          return value.call(target, url, ...args);
        };
      },
    });
    await use(guarded);
  },
});

export { expect };
