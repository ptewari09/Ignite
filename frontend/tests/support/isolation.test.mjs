import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { createOwnedRun, discardOwnedRun } from './run-live-browser.mjs';

test('cleanup removes only a new marked database and its SQLite sidecars', async () => {
  const run = createOwnedRun();
  writeFileSync(run.database, 'Fictional test-only file');
  writeFileSync(`${run.database}-journal`, 'Fictional sidecar');
  await discardOwnedRun(run, { projects: 1 });
  assert.equal(existsSync(run.directory), false);
});

test('a mismatched owner cannot remove records or the marker', async () => {
  const run = createOwnedRun();
  writeFileSync(run.database, 'Keep this fictional database');
  await assert.rejects(discardOwnedRun({ ...run, runId: 'other-run' }), /Ownership mismatch/);
  assert.equal(readFileSync(run.database, 'utf8'), 'Keep this fictional database');
  assert.equal(existsSync(run.marker), true);
  await discardOwnedRun(run);
});

test('unexpected files preserve the whole directory instead of recursive deletion', async () => {
  const run = createOwnedRun();
  const unexpected = join(run.directory, 'keep-this.txt');
  writeFileSync(run.database, 'Fictional database');
  writeFileSync(unexpected, 'Unrecognized output');
  await assert.rejects(discardOwnedRun(run), /preserving all files/);
  assert.equal(existsSync(run.database), true);
  assert.equal(existsSync(run.marker), true);
  assert.equal(readFileSync(unexpected, 'utf8'), 'Unrecognized output');
  // This test owns this explicitly identified fixture file; no existing file
  // or database outside the newly created run is touched.
  unlinkSync(unexpected);
  await discardOwnedRun(run);
});
