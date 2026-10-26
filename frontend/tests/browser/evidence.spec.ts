import { expect, test } from '../support/safeBrowser';
import type { Page } from '@playwright/test';
import type { EvidenceKind, EvidenceRecord, TransformationFinding, UploadError, UploadObject } from '../../src/types/evidence';
import type { Workbook } from '../../src/types/workbook';

const projectId = '00000000-0000-4000-8000-000000000201';
const firstCycle = '00000000-0000-4000-8000-000000000202';
const secondCycle = '00000000-0000-4000-8000-000000000203';

function records(cycleId: string, total: number): Record<EvidenceKind, EvidenceRecord[]> {
  const base = { object_type_raw: ' prog  ', object_name_raw: ' z_synthetic_order ', object_type_normalized: 'PROG', object_name_normalized: 'Z_SYNTHETIC_ORDER', raw_payload: { 'Object Type': ' prog  ', 'Extra count': 0 } };
  const a: TransformationFinding[] = Array.from({ length: total }, (_, index) => ({ ...base, id: `${cycleId}-a-${index}`, workbook_id: `${cycleId}-a`, worksheet_name: 'Detailed_LOG', excel_row_number: index + 2,
    object_name_raw: index < 2 ? base.object_name_raw : `Z_SYNTH_${String(index).padStart(3, '0')}`,
    status_raw: '@0A@', error_category_raw: index === 1 ? 'NO_TLAYER' : 'OBJ_LOCKED', error_message_raw: `Synthetic finding ${index}.\nOriginal second line.`, suggested_action_raw: null, file_name_raw: null }));
  const b: UploadObject[] = [0, 1].map((index) => ({ ...base, id: `${cycleId}-b-${index}`, workbook_id: `${cycleId}-b`, worksheet_name: 'Objects', excel_row_number: index + 2,
    status_info_raw: 'DEMO ', tool_status_raw: 'UPLD_ERROR', re_upload_raw: '@4R@', manual_status_raw: index ? 'Needs review' : 'Uploaded', manual_comments_raw: `Synthetic manual note ${index}.` }));
  const c: UploadError[] = [0, 1].map((index) => ({ ...base, id: `${cycleId}-c-${index}`, workbook_id: `${cycleId}-b`, worksheet_name: 'Errors', excel_row_number: index + 2,
    object_type_raw: index ? '    ' : base.object_type_raw, object_name_raw: index ? null : base.object_name_raw,
    object_type_normalized: index ? null : 'PROG', object_name_normalized: index ? null : base.object_name_normalized,
    info_raw: 'DEMO', sequence_number: index, message_type_raw: 'W ', message_raw: index ? 'Synthetic message without identity.' : 'Synthetic message with identity.' }));
  return { 'transformation-findings': a, 'upload-objects': b, 'upload-errors': c };
}

async function fixture(page: Page) {
  const requests: { cycleId: string; kind: string; offset: number; limit: number }[] = [];
  const behavior = { failNext: false, holdNext: false };
  let release: (() => void) | undefined;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('GET');
    const url = new URL(request.url());
    const match = url.pathname.match(/\/cycles\/([^/]+)\/(transformation-findings|upload-objects|upload-errors|workbooks)$/);
    if (match) {
      const [, cycleId, endpoint] = match;
      const rows = records(cycleId, cycleId === firstCycle ? 31 : 1);
      if (endpoint === 'workbooks') {
        const a: Workbook = { id: `${cycleId}-a`, cycle_id: cycleId, role: 'transformation', original_filename: 'synthetic-transformation.xlsx', sha256: 'a'.repeat(64), byte_size: 5120, uploaded_at: '2026-01-01T10:00:00Z', ingestion_status: 'ingested', sheets_found: ['Detailed_LOG'], row_counts: { Detailed_LOG: rows['transformation-findings'].length }, object_counts: { Detailed_LOG: 1 }, warnings: [] };
        const b: Workbook = { ...a, id: `${cycleId}-b`, role: 'post_upload', original_filename: 'synthetic-post-upload.xlsx', sheets_found: ['Objects', 'Errors'], row_counts: { Objects: 2, Errors: 2 }, object_counts: { Objects: 1, Errors: 1 } };
        await route.fulfill({ json: { items: [a, b], total: 2, limit: 200, offset: 0 } }); return;
      }
      const limit = Number(url.searchParams.get('limit'));
      const offset = Number(url.searchParams.get('offset'));
      requests.push({ cycleId, kind: endpoint, limit, offset });
      if (behavior.holdNext) { behavior.holdNext = false; await new Promise<void>((resolve) => { release = resolve; }); }
      if (request.failure()) return;
      if (behavior.failNext) { behavior.failNext = false; await route.fulfill({ status: 503, json: { error: { code: 'TEST_ERROR', message: 'Synthetic source detail must not leak' }, request_id: 'evidence-browser' } }); return; }
      const items = rows[endpoint as EvidenceKind];
      await route.fulfill({ json: { items: items.slice(offset, offset + limit), total: items.length, limit, offset } }); return;
    }
    const items = url.pathname.endsWith('/cycles')
      ? [firstCycle, secondCycle].map((id, index) => ({ id, project_id: projectId, name: `Evidence run ${index + 1}`, created_at: '2026-01-01T10:00:00Z', ingestion_status: 'complete' }))
      : [{ id: projectId, name: 'Synthetic evidence project', description: null, created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' }];
    await route.fulfill({ json: { items, total: items.length, limit: 200, offset: 0 } });
  });
  return { requests, behavior, release: () => release?.() };
}

async function openEvidence(page: Page) {
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Select project Synthetic evidence project' }).click();
  await page.getByRole('button', { name: 'Select cycle Evidence run 1' }).click();
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Evidence Explorer', exact: true }).click();
  await expect(page.getByText('Records 1–25 of 31', { exact: true })).toBeVisible();
}

test('controlled evidence browsing preserves rows, provenance, raw data and bounded pagination', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await fixture(page);
  await openEvidence(page);
  const inspect = page.getByRole('button', { name: 'Inspect Detailed_LOG row 2', exact: true });
  await inspect.click();
  const dialog = page.getByRole('dialog', { name: 'Evidence record details' });
  await expect(dialog.getByRole('button', { name: 'Close record details' })).toBeFocused();
  await expect(dialog.getByText('" prog  "', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Z_SYNTHETIC_ORDER', { exact: true })).toBeVisible();
  await dialog.getByText('Original row payload — all source columns', { exact: true }).click();
  expect(JSON.parse(await dialog.getByLabel('Original row payload', { exact: true }).innerText())).toEqual({ 'Object Type': ' prog  ', 'Extra count': 0 });
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: 'test-results/evidence-detail-desktop.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(inspect).toBeFocused();
  const previousCalls = state.requests.length;
  await page.getByRole('searchbox', { name: 'Filter current page' }).fill('Z_SYNTH_029');
  await expect(page.getByRole('heading', { name: 'No matches on this page' })).toBeVisible();
  expect(state.requests).toHaveLength(previousCalls);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Records 26–31 of 31', { exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByRole('cell', { name: 'Z_SYNTH_029', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/evidence-desktop.png', animations: 'disabled' });
  await page.getByRole('tab', { name: 'Upload Objects', exact: true }).click();
  await expect(page.getByText('Records 1–2 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Tool status', exact: true })).toBeAttached();
  await expect(page.getByRole('columnheader', { name: 'Imported manual status', exact: true })).toBeAttached();
  await page.getByRole('button', { name: 'Inspect Objects row 2', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Imported manual annotations' })).toBeVisible();
  await expect(dialog.getByText('"UPLD_ERROR"', { exact: true })).toBeVisible();
  await expect(dialog.getByText('"Uploaded"', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(state.requests.every((request) => request.limit === 25)).toBe(true);
});

test('controlled retry and rapid tab/cycle changes never apply an older response', async ({ page }) => {
  const state = await fixture(page);
  await openEvidence(page);
  state.behavior.failNext = true;
  await page.getByRole('button', { name: 'Refresh page' }).click();
  await expect(page.getByRole('alert')).toContainText('evidence-browser');
  await expect(page.getByText('Synthetic source detail must not leak')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Records 1–25 of 31', { exact: true })).toBeVisible();
  state.behavior.holdNext = true;
  const count = state.requests.length;
  await page.getByRole('button', { name: 'Refresh page' }).click();
  await expect.poll(() => state.requests.length).toBeGreaterThan(count);
  await page.getByRole('tab', { name: 'Upload Errors', exact: true }).click();
  await expect(page.getByText('Records 1–2 of 2', { exact: true })).toBeVisible();
  state.release();
  await expect(page.getByRole('columnheader', { name: 'Message type', exact: true })).toBeAttached();
  await expect(page.getByRole('columnheader', { name: 'Error category', exact: true })).toHaveCount(0);
  state.behavior.holdNext = true;
  await page.getByRole('button', { name: 'Refresh page' }).click();
  await expect(page.getByText('Loading upload errors…', { exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await navigation.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Select cycle Evidence run 2' }).click();
  await navigation.getByRole('link', { name: 'Evidence Explorer', exact: true }).click();
  await expect(page.getByText('Records 1–1 of 1', { exact: true })).toBeVisible();
  state.release();
  await expect(page.getByRole('tab', { name: 'Transformation Findings', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('searchbox')).toHaveValue('');
});

test('320px tabs, horizontally scrollable evidence and detail focus remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fixture(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openEvidence(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('tab', { name: 'Transformation Findings', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Upload Errors', exact: true })).toBeFocused();
  await expect(page.getByText('Records 1–2 of 2', { exact: true })).toBeVisible();
  const scrollRegion = page.getByRole('region', { name: 'Upload Errors table, scroll horizontally for all columns', exact: true });
  await scrollRegion.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/evidence-320.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Inspect Errors row 3', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('"    "', { exact: true })).toBeVisible();
  await expect(dialog.getByText('"Synthetic message without identity."', { exact: true })).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320).toBeTruthy();
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: 'test-results/evidence-detail-320.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Inspect Errors row 3', exact: true })).toBeFocused();
});
