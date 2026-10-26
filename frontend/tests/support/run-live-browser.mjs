import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const root = resolve(frontend, '..');
export const outputRoot = join(root, 'data/outputs/browser-tests');
const api = 'http://127.0.0.1:8001/api/v1';
const delay = (ms) => new Promise((done) => setTimeout(done, ms));

function within(parent, child) {
  const part = relative(parent, child);
  return !!part && part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}

export function createOwnedRun(mode = 'live') {
  mkdirSync(outputRoot, { recursive: true });
  if (!within(realpathSync(root), realpathSync(outputRoot))) throw new Error('Test output must stay inside the repository.');
  const directory = mkdtempSync(join(outputRoot, mode === 'live' ? 'live-' : 'controlled-'));
  const run = { runId: randomUUID(), directory, database: join(directory, 'acceptance.sqlite3'), marker: join(directory, 'ownership.json') };
  writeFileSync(run.marker, JSON.stringify({ runId: run.runId, database: run.database }), { flag: 'wx' });
  return run;
}

export async function discardOwnedRun(run, counts = {}) {
  const actualRoot = realpathSync(outputRoot);
  const directory = realpathSync(run.directory);
  if (!within(actualRoot, directory) || dirname(directory) !== actualRoot) throw new Error('Refusing cleanup outside this test run.');
  const names = new Set(['ownership.json', 'acceptance.sqlite3', 'acceptance.sqlite3-journal', 'acceptance.sqlite3-wal', 'acceptance.sqlite3-shm']);
  const marker = JSON.parse(readFileSync(join(directory, 'ownership.json'), 'utf8'));
  if (marker.runId !== run.runId || marker.database !== join(directory, 'acceptance.sqlite3')) throw new Error('Ownership mismatch; database preserved.');
  const files = readdirSync(directory);
  // Validate every target before removing anything. No recursive deletion is used.
  for (const name of files) {
    const target = resolve(directory, name);
    if (!names.has(name) || !within(directory, target) || lstatSync(target).isSymbolicLink() || !lstatSync(target).isFile()) {
      throw new Error('Unexpected test output; preserving all files for inspection.');
    }
  }
  console.log(`Discarding only this run's database: ${relative(root, run.database)}; records: ${JSON.stringify(counts)}`);
  for (const name of files.filter((name) => name !== 'ownership.json').concat('ownership.json')) {
    const target = join(directory, name);
    for (let attempt = 0; ; attempt += 1) {
      try { unlinkSync(target); break; }
      catch (error) {
        if (attempt >= 20 || !['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) throw error;
        await delay(100);
      }
    }
  }
  rmdirSync(directory); // Only succeeds for an empty, verified, owned directory.
}

async function requireFreePort(port) {
  await new Promise((done, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Test port ${port} is occupied. No existing server will be reused or stopped.`)));
    probe.listen({ host: '127.0.0.1', port, exclusive: true }, () => probe.close(done));
  });
}

async function stopOwnedChild(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    // Direct process handles avoid Windows shell/npm tree-shutdown failures.
    child.kill('SIGTERM');
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  for (let attempt = 0; attempt < 50 && child.exitCode === null && child.signalCode === null; attempt += 1) await delay(100);
  if (child.exitCode === null && child.signalCode === null) throw new Error('Owned server did not stop; preserving its database.');
}

function inspectOwnedRun(python, helper, run) {
  if (!existsSync(run.database)) return {};
  const result = spawnSync(python, [helper, '--database', run.database, '--run-id', run.runId, '--inspect'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Cannot inventory the test database; preserving it for inspection.');
  return JSON.parse(result.stdout);
}

async function stopOwnedBackend(backend, backendPid, run) {
  if (backendPid && process.platform === 'win32') {
    // Verify this freshly owned server's token/PID immediately before stop.
    const response = await fetch(`${api}/ready`, { signal: AbortSignal.timeout(1000) });
    if (response.headers.get('x-tracesync-test-run') !== run.runId
      || Number(response.headers.get('x-tracesync-test-pid')) !== backendPid) {
      throw new Error('Owned backend identity changed; preserving its database.');
    }
    process.kill(backendPid, 'SIGTERM');
  }
  await stopOwnedChild(backend);
}

export async function runBrowserTests(args = []) {
  const live = args[0] !== '--controlled';
  if (!live) args = args.slice(1);
  if (process.env.TRACESYNC_LIVE_API_URL && process.env.TRACESYNC_LIVE_API_URL !== api) {
    throw new Error('External API targets are disabled. Remove TRACESYNC_LIVE_API_URL and use npm run test:browser:live.');
  }
  if (live) await requireFreePort(8001);
  await requireFreePort(5174);
  const run = createOwnedRun(live ? 'live' : 'controlled');
  const python = process.env.TRACESYNC_TEST_PYTHON || join(root, 'backend/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const helper = join(frontend, 'tests/support/live_backend.py');
  let backend;
  let backendPid;
  let frontendServer;
  let browser;
  let interrupted = false;
  let exitCode = 1;
  const onSignal = () => { interrupted = true; if (browser) void stopOwnedChild(browser); };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  console.log(live
    ? `Owned test run ${run.runId}: a NEW database at ${relative(root, run.database)} will be discarded after success or failure. Existing databases are excluded.`
    : `Controlled browser run ${run.runId}: isolated frontend on port 5174; all API calls must be mocked; no database is used.`);
  try {
    const childEnv = { ...process.env };
    for (const key of Object.keys(childEnv)) if (key.toUpperCase().startsWith('TRACESYNC_')) delete childEnv[key];
    if (live) {
      backend = spawn(python, [helper, '--database', run.database, '--run-id', run.runId], {
        cwd: root, env: childEnv, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true, detached: process.platform !== 'win32',
      });
      let startupError;
      backend.on('error', (error) => { startupError = error; });
      let ready = false;
      for (let attempt = 0; attempt < 150 && !interrupted; attempt += 1) {
        if (startupError) throw startupError;
        if (backend.exitCode !== null) throw new Error('Test backend exited before readiness.');
        try {
          const response = await fetch(`${api}/ready`, { signal: AbortSignal.timeout(500) });
          if (response.headers.get('x-tracesync-test-run') !== run.runId) throw new Error('REFUSE_OTHER_SERVER');
          if (response.ok) { backendPid = Number(response.headers.get('x-tracesync-test-pid')); ready = true; break; }
        } catch (error) { if (error.message === 'REFUSE_OTHER_SERVER') throw new Error('Refusing a backend not owned by this test run.', { cause: error }); }
        await delay(200);
      }
      if (!ready) throw new Error(interrupted ? 'Interrupted during test startup.' : 'Timed out starting the owned test backend.');
    }
    frontendServer = spawn(process.execPath, [join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
      cwd: frontend, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true, detached: process.platform !== 'win32',
      env: { ...process.env, VITE_API_BASE_URL: api },
    });
    let frontendError;
    frontendServer.on('error', (error) => { frontendError = error; });
    let frontendReady = false;
    for (let attempt = 0; attempt < 100 && !interrupted; attempt += 1) {
      if (frontendError) throw frontendError;
      if (frontendServer.exitCode !== null) throw new Error('Owned test frontend exited before readiness.');
      try { const response = await fetch('http://127.0.0.1:5174/', { signal: AbortSignal.timeout(500) }); if (response.ok) { frontendReady = true; break; } } catch { /* Not ready yet. */ }
      await delay(200);
    }
    if (!frontendReady) throw new Error('Owned test frontend did not become ready.');
    browser = spawn(process.execPath, [join(frontend, 'node_modules/playwright/cli.js'), 'test', '--config', live ? 'playwright.live.config.ts' : 'playwright.config.ts', ...args], {
      cwd: frontend, stdio: 'inherit', windowsHide: true, detached: process.platform !== 'win32',
      env: { ...process.env, TRACESYNC_BROWSER_RUN_ID: run.runId,
        TRACESYNC_ACCEPTANCE_RUN_ID: live ? run.runId : '', TRACESYNC_ACCEPTANCE_MARKER: run.marker, TRACESYNC_TEST_PYTHON: python },
    });
    exitCode = await new Promise((done, reject) => { browser.once('error', reject); browser.once('exit', (code) => done(code ?? 1)); });
  } finally {
    let cleaned = false;
    let counts = {};
    try {
      await stopOwnedChild(browser);
      await stopOwnedChild(frontendServer);
      await stopOwnedBackend(backend, backendPid, run);
      counts = inspectOwnedRun(python, helper, run);
      await discardOwnedRun(run, counts);
      cleaned = true;
    } finally {
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      writeFileSync(join(outputRoot, `summary-${run.runId}.json`), JSON.stringify({ runId: run.runId, live, database: live ? run.database : null, exitCode: cleaned ? exitCode : 1, interrupted, counts, cleaned }, null, 2));
    }
  }
  return interrupted ? 130 : exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runBrowserTests(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(`Browser-test isolation: ${error.message}`);
    process.exitCode = 1;
  });
}
