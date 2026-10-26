import { readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { defineConfig } from '@playwright/test';
import config from './playwright.config';

const runId = process.env.TRACESYNC_ACCEPTANCE_RUN_ID;
const markerPath = process.env.TRACESYNC_ACCEPTANCE_MARKER;
if (!runId || !markerPath) throw new Error('Start live tests with npm run test:browser:live, which owns and cleans its database.');
const marker = realpathSync(markerPath);
const allowed = realpathSync(resolve('../data/outputs/browser-tests'));
const part = relative(allowed, marker);
if (isAbsolute(part) || part.startsWith(`..${sep}`) || dirname(marker) === allowed
  || JSON.parse(readFileSync(marker, 'utf8')).runId !== runId) throw new Error('Invalid live-test ownership marker.');

export default defineConfig({
  ...config,
  metadata: { acceptanceRunId: runId, acceptanceApi: 'http://127.0.0.1:8001/api/v1' },
});
