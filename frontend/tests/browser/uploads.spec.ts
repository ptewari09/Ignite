import { createHash } from 'node:crypto';
import { expect, test } from '../support/safeBrowser';
import type { Page } from '@playwright/test';
import type { Workbook } from '../../src/types/workbook';

const projectId = '00000000-0000-4000-8000-000000000101';
const cycleOne = '00000000-0000-4000-8000-000000000102';
const cycleTwo = '00000000-0000-4000-8000-000000000103';
const workbookBytes = Buffer.from('Fictional controlled file selection; the server response is mocked.');
const fileA = { name: 'synthetic-transformation.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbookBytes };
const fileB = { ...fileA, name: 'synthetic-post-upload.xlsx' };

async function fixture(page: Page) {
  const saved: Workbook[] = [];
  const attempts: { cycleId: string; role: string; contentType: string }[] = [];
  const behavior = { failList: false, failUpload: false, holdUpload: false };
  let release: (() => void) | undefined;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cycleId = url.pathname.match(/\/cycles\/([^/]+)\/workbooks$/)?.[1];
    if (request.method() === 'POST' && cycleId) {
      const body = request.postDataBuffer()!.toString('latin1');
      const role = body.match(/name="role"\r\n\r\n(transformation|post_upload)/)?.[1];
      const filename = body.match(/name="file"; filename="([^"]+)"/)?.[1];
      if (!role || !filename) throw new Error('Expected exact role/file multipart fields');
      const part = body.split(/name="file"; filename="[^"]+"/)[1].split('\r\n\r\n').slice(1).join('\r\n\r\n').split('\r\n--')[0];
      const sha = createHash('sha256').update(part).digest('hex');
      attempts.push({ cycleId, role, contentType: request.headers()['content-type'] });
      if (behavior.holdUpload) await new Promise<void>((resolve) => { release = resolve; });
      if (behavior.failUpload) {
        behavior.failUpload = false;
        await route.fulfill({ status: 422, json: { error: { code: 'INVALID_WORKBOOK', message: 'A synthetic source value should never be displayed.' }, request_id: 'browser-invalid' } });
        return;
      }
      const existing = saved.find((item) => item.role === role && item.cycle_id === cycleId);
      if (existing && existing.sha256 !== sha) {
        await route.fulfill({ status: 409, json: { error: { code: 'WORKBOOK_ROLE_OCCUPIED', message: 'Existing fictional role.' }, request_id: 'browser-conflict' } });
        return;
      }
      const workbook: Workbook = existing ?? { id: `synthetic-${cycleId}-${role}`, cycle_id: cycleId,
        role: role as Workbook['role'], original_filename: filename, sha256: sha, byte_size: Buffer.byteLength(part),
        uploaded_at: '2026-01-03T10:00:00Z', ingestion_status: 'ingested',
        sheets_found: role === 'transformation' ? ['Detailed_LOG'] : ['Objects', 'Errors'],
        row_counts: role === 'transformation' ? { Detailed_LOG: 3 } : { Objects: 3, Errors: 4 },
        object_counts: role === 'transformation' ? { Detailed_LOG: 1 } : { Objects: 2, Errors: 2 }, warnings: [] };
      if (!existing) saved.push(workbook);
      if (request.failure()) return; // Simulate a server save despite a canceled browser request.
      await route.fulfill({ status: existing ? 200 : 201, json: { workbook, duplicate: !!existing } });
      return;
    }
    if (cycleId) {
      if (behavior.failList) {
        behavior.failList = false;
        await route.fulfill({ status: 503, json: { error: { code: 'DATABASE_UNAVAILABLE', message: 'Synthetic unavailable.' }, request_id: 'browser-list' } });
        return;
      }
      const items = saved.filter((item) => item.cycle_id === cycleId);
      await route.fulfill({ json: { items, total: items.length, limit: 200, offset: 0 } });
      return;
    }
    const items = url.pathname.endsWith('/cycles') ? [
      { id: cycleOne, project_id: projectId, name: 'Synthetic upload run 1', created_at: '2026-01-02T10:00:00Z', ingestion_status: 'empty' },
      { id: cycleTwo, project_id: projectId, name: 'Synthetic upload run 2', created_at: '2026-01-02T10:00:00Z', ingestion_status: 'empty' },
    ] : [{ id: projectId, name: 'Synthetic upload project', description: null, created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' }];
    await route.fulfill({ json: { items, total: items.length, limit: 200, offset: 0 } });
  });
  return { saved, attempts, behavior, releaseUpload: () => release?.() };
}

async function openWorkspace(page: Page, cycle = 'Synthetic upload run 1') {
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Select project Synthetic upload project' }).click();
  await page.getByRole('button', { name: `Select cycle ${cycle}` }).click();
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Upload Reports', exact: true }).click();
  await expect(page.getByLabel('Transformation Report workbook', { exact: true })).toBeEnabled();
}

test('controlled uploads preserve saved counts, identical duplicates and occupied roles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const state = await fixture(page);
  await openWorkspace(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByLabel('Transformation Report workbook', { exact: true }).setInputFiles(fileA);
  await page.getByRole('button', { name: 'Upload Transformation Report', exact: true }).click();
  await expect(page.getByText('Uploaded successfully', { exact: true })).toHaveCount(1);
  await page.getByLabel('Post-Upload Report workbook', { exact: true }).setInputFiles(fileB);
  await page.getByRole('button', { name: 'Upload Post-Upload Report', exact: true }).click();
  await expect(page.getByText('Uploaded successfully', { exact: true })).toHaveCount(2);
  await page.getByLabel('Transformation Report workbook', { exact: true }).setInputFiles(fileA);
  await page.getByRole('button', { name: 'Check duplicate Transformation Report', exact: true }).click();
  await expect(page.getByText(/Duplicate re-upload: this workbook was already imported/)).toBeVisible();
  expect(state.saved).toHaveLength(2);
  await page.getByLabel('Transformation Report workbook', { exact: true }).setInputFiles({ ...fileA, name: 'different.xlsx', buffer: Buffer.from('Different fictional bytes') });
  await page.getByRole('button', { name: 'Check duplicate Transformation Report', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already contains a different workbook');
  expect(state.saved[0].original_filename).toBe(fileA.name);
  expect(state.attempts.every((attempt) => attempt.cycleId === cycleOne && attempt.contentType.includes('multipart/form-data; boundary='))).toBe(true);
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await navigation.getByRole('link', { name: 'Overview', exact: true }).click();
  await navigation.getByRole('link', { name: 'Upload Reports', exact: true }).click();
  await expect(page.getByText('Uploaded successfully', { exact: true })).toHaveCount(2);
  await expect(page.getByText(/Duplicate re-upload:/)).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/uploads-desktop.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('controlled list failures and invalid workbooks offer a safe retry', async ({ page }) => {
  const state = await fixture(page);
  await openWorkspace(page);
  state.behavior.failList = true;
  await page.getByRole('button', { name: 'Refresh saved reports' }).click();
  await expect(page.getByRole('alert')).toContainText('browser-list');
  await expect(page.getByRole('button', { name: 'Choose file for Transformation Report' })).toBeDisabled();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByLabel('Transformation Report workbook', { exact: true })).toBeEnabled();
  await page.getByLabel('Transformation Report workbook', { exact: true }).setInputFiles({ ...fileA, name: 'unsupported.xls' });
  await expect(page.getByRole('alert')).toContainText('Choose an .xlsx workbook');
  expect(state.attempts).toHaveLength(0);
  state.behavior.failUpload = true;
  await page.getByLabel('Transformation Report workbook', { exact: true }).setInputFiles(fileA);
  await page.getByRole('button', { name: 'Upload Transformation Report', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not a supported, readable workbook');
  await expect(page.getByText('A synthetic source value should never be displayed.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Upload Transformation Report', exact: true }).click();
  await expect(page.getByText('Uploaded successfully', { exact: true })).toBeVisible();
});

test('320px keyboard file picker and drag/drop remain accessible without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fixture(page);
  // The mobile drawer is tested elsewhere; use real project links before resize.
  await page.setViewportSize({ width: 1280, height: 900 });
  await openWorkspace(page);
  await page.setViewportSize({ width: 320, height: 844 });
  const choose = page.getByRole('button', { name: 'Choose file for Transformation Report' });
  const metadataBox = await page.locator('.upload-workspace-context dl').boundingBox();
  const workspaceLinkBox = await page.getByRole('link', { name: 'Manage workspace', exact: true }).boundingBox();
  expect(metadataBox && workspaceLinkBox && workspaceLinkBox.y >= metadataBox.y + metadataBox.height).toBeTruthy();
  await choose.focus();
  const chooserEvent = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooserEvent).setFiles(fileA);
  await expect(page.getByRole('button', { name: 'Clear file for Transformation Report' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear file for Transformation Report' }).click();
  await expect(choose).toBeFocused();
  await page.getByRole('region', { name: 'Transformation Report', exact: true }).locator('.file-dropzone').evaluate((zone) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['Fictional drag/drop bytes'], 'synthetic-dropped.xlsx'));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(page.getByText('synthetic-dropped.xlsx', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Upload Transformation Report', exact: true }).click();
  await expect(page.getByText('Uploaded successfully', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/uploads-320.png', fullPage: true, animations: 'disabled' });
});

test('changing cycles during a pending upload clears files and isolates the response', async ({ page }) => {
  const state = await fixture(page);
  await openWorkspace(page);
  state.behavior.holdUpload = true;
  await page.getByLabel('Transformation Report workbook', { exact: true }).setInputFiles(fileA);
  await page.getByRole('button', { name: 'Upload Transformation Report', exact: true }).click();
  await expect.poll(() => state.attempts.length).toBe(1);
  await page.getByRole('form', { name: 'Upload Transformation Report', exact: true }).evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(state.attempts).toHaveLength(1);
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await navigation.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Select cycle Synthetic upload run 2' }).click();
  await navigation.getByRole('link', { name: 'Upload Reports', exact: true }).click();
  await expect(page.getByLabel('Transformation Report workbook', { exact: true })).toBeEnabled();
  state.releaseUpload();
  await expect.poll(() => state.saved.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Clear file for Transformation Report' })).toHaveCount(0);
  await expect(page.getByText('Uploaded successfully', { exact: true })).toHaveCount(0);
  await expect(page.locator('dd').getByText('Synthetic upload run 2', { exact: true })).toBeVisible();
  expect(state.attempts[0].cycleId).toBe(cycleOne);
});
