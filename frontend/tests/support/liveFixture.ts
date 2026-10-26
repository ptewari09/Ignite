import { expect, test as base } from './safeBrowser';

// Every test that can create real records must pass this guard before its body.
export const test = base.extend<{ verifiedLiveApi: string }>({
  verifiedLiveApi: async ({ request, baseURL }, use, testInfo) => {
    const { acceptanceRunId, acceptanceApi } = testInfo.config.metadata;
    if (!acceptanceRunId) {
      base.skip(true, 'Use npm run test:browser:live; arbitrary existing API servers are never used.');
      return;
    }
    if (acceptanceApi !== 'http://127.0.0.1:8001/api/v1' || baseURL !== 'http://127.0.0.1:5174') {
      throw new Error('Refusing live writes outside the dedicated test API/frontend ports.');
    }
    const readiness = await request.get(`${acceptanceApi}/ready`);
    expect(readiness.status()).toBe(200);
    expect(readiness.headers()['x-tracesync-test-run']).toBe(acceptanceRunId);
    await use(acceptanceApi);
  },
});

export { expect };
