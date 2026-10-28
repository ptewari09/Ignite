import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '../support/liveFixture';
import type { Page } from '@playwright/test';
import type { WorkbookUpload } from '../../src/types/workbook';
import type { UploadError, UploadObject } from '../../src/types/evidence';
import type { Page as EvidencePage } from '../../src/types/workspace';

test('live FastAPI validates synthetic XLSX files and persists both roles without replacement', async ({ page, request, verifiedLiveApi: api }, testInfo) => {
  test.setTimeout(90_000);
  const root = resolve('..');
  const python = process.env.TRACESYNC_TEST_PYTHON ?? resolve(root, 'backend/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  execFileSync(python, ['-m', 'app.scripts.generate_demo_workbooks', '--output', testInfo.outputDir], { cwd: root, stdio: 'pipe' });
  // Additional fictional invalid-layout and changed-content workbooks; no real
  // customer files are read. Generated XLSX binaries remain in ignored output.
  const build = [
    'from pathlib import Path', 'import sys', 'from openpyxl import Workbook, load_workbook',
    'folder = Path(sys.argv[1])',
    'for filename, sheetname in [("missing-sheet.xlsx", "Wrong_sheet"), ("missing-columns.xlsx", "Detailed_LOG")]:',
    '    book = Workbook()', '    book.active.title = sheetname', '    book.active.append(["Synthetic wrong header"])',
    '    book.save(folder / filename)', '    book.close()',
    'book = load_workbook(folder / "synthetic-transformation.xlsx")',
    'book["Detailed_LOG"].cell(2, 5).value = "A different fictional message."',
    'book.save(folder / "different-transformation.xlsx")', 'book.close()',
    'sys.path.insert(0, str(Path.cwd() / "backend"))',
    'from tests.fixtures.workbooks import raw_post_upload_bytes, transformation_layout_bytes',
    '(folder / "raw-transformation.xlsx").write_bytes(transformation_layout_bytes("Detailed_Log"))',
    '(folder / "raw-post-upload.xlsx").write_bytes(raw_post_upload_bytes())',
    'book = load_workbook(folder / "raw-post-upload.xlsx")',
    'book.copy_worksheet(book["Sheet1"]).title = "Objects"',
    'book.copy_worksheet(book["Sheet2"]).title = "Errors"',
    'book.save(folder / "ambiguous-post-upload.xlsx")', 'book.close()',
  ].join('\n');
  execFileSync(python, ['-c', build, testInfo.outputDir], { cwd: root, stdio: 'pipe' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  const label = `Synthetic upload acceptance ${Date.now()}`;
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project name', { exact: false }).fill(label);
  const projectHttp = page.waitForResponse((response) => response.url() === `${api}/projects` && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  const project = await (await projectHttp).json() as { id: string };
  await page.getByRole('button', { name: 'New cycle', exact: true }).click();
  await page.getByLabel('Cycle name', { exact: false }).fill('Synthetic ingestion cycle');
  const cycleHttp = page.waitForResponse((response) => response.url() === `${api}/projects/${project.id}/cycles` && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create cycle', exact: true }).click();
  const cycle = await (await cycleHttp).json() as { id: string };
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await navigation.getByRole('link', { name: 'Upload Reports', exact: true }).click();
  const endpoint = `${api}/cycles/${cycle.id}/workbooks`;
  const input = page.getByLabel('Transformation Report workbook', { exact: true });
  await expect(input).toBeEnabled();
  async function upload(title: string, file: Parameters<ReturnType<Page['getByLabel']>['setInputFiles']>[0], expectedStatus: number, duplicate = false) {
    await page.getByLabel(`${title} workbook`, { exact: true }).setInputFiles(file);
    const response = page.waitForResponse((result) => result.url() === endpoint && result.request().method() === 'POST');
    await page.getByRole('button', { name: `${duplicate ? 'Check duplicate' : 'Upload'} ${title}`, exact: true }).click();
    const http = await response;
    expect(http.status()).toBe(expectedStatus);
    expect(http.request().headers()['content-type']).toContain('multipart/form-data; boundary=');
    expect(http.headers()['access-control-allow-origin']).toBe(new URL(page.url()).origin);
    return http;
  }
  await upload('Transformation Report', { name: 'invalid.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('Synthetic invalid XLSX') }, 422);
  await expect(page.getByRole('alert')).toContainText('not a supported, readable workbook');
  for (const [file, message] of [['missing-sheet.xlsx', 'Required worksheets are missing'], ['missing-columns.xlsx', 'Required columns are missing']]) {
    await upload('Transformation Report', resolve(testInfo.outputDir, file), 422);
    await expect(page.getByRole('alert')).toContainText(message);
  }
  expect((await (await request.get(endpoint)).json()).total).toBe(0);
  expect((await (await request.get(`${api}/cycles/${cycle.id}/transformation-findings`)).json()).total).toBe(0);
  const aPath = resolve(testInfo.outputDir, 'synthetic-transformation.xlsx');
  const first = await (await upload('Transformation Report', aPath, 201)).json() as WorkbookUpload;
  expect(first.duplicate).toBe(false);
  expect(first.workbook.row_counts).toEqual({ Detailed_LOG: 3 });
  await expect(page.getByText('Uploaded successfully', { exact: true })).toHaveCount(1);
  const repeated = await (await upload('Transformation Report', { name: 'renamed-same-bytes.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: readFileSync(aPath) }, 200, true)).json() as WorkbookUpload;
  expect(repeated.duplicate).toBe(true);
  expect(repeated.workbook.id).toBe(first.workbook.id);
  expect(repeated.workbook.uploaded_at).toBe(first.workbook.uploaded_at);
  expect(repeated.workbook.original_filename).toBe('synthetic-transformation.xlsx');
  await expect(page.getByText(/Duplicate re-upload:/)).toBeVisible();
  await upload('Transformation Report', resolve(testInfo.outputDir, 'different-transformation.xlsx'), 409, true);
  await expect(page.getByRole('alert')).toContainText('already contains a different workbook');
  await expect(input).toBeEnabled();
  const post = await (await upload('Post-Upload Report', resolve(testInfo.outputDir, 'synthetic-post-upload.xlsx'), 201)).json() as WorkbookUpload;
  expect(post.workbook.row_counts).toEqual({ Objects: 3, Errors: 4 });
  const saved = await (await request.get(endpoint)).json();
  expect(saved.total).toBe(2);
  expect(saved.items).toContainEqual(expect.objectContaining({ id: first.workbook.id, sha256: first.workbook.sha256 }));
  for (const [path, count] of [['transformation-findings', 3], ['upload-objects', 3], ['upload-errors', 4]]) {
    expect((await (await request.get(`${api}/cycles/${cycle.id}/${path}`)).json()).total).toBe(count);
  }
  const cycles = await (await request.get(`${api}/projects/${project.id}/cycles`)).json();
  expect(cycles.items).toContainEqual(expect.objectContaining({ id: cycle.id, ingestion_status: 'complete' }));
  await navigation.getByRole('link', { name: 'Overview', exact: true }).click();
  await navigation.getByRole('link', { name: 'Upload Reports', exact: true }).click();
  await expect(page.getByText('Uploaded successfully', { exact: true })).toHaveCount(2);
  await expect(page.getByText(/Duplicate re-upload:/)).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/uploads-live-desktop.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/uploads-live-320.png', fullPage: true, animations: 'disabled' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Choose a project and upload cycle' })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole('link', { name: 'Go to Projects' }).click();
  await page.getByRole('button', { name: `Select project ${label}` }).click();
  await page.getByRole('button', { name: 'Select cycle Synthetic ingestion cycle' }).click();
  await navigation.getByRole('link', { name: 'Upload Reports', exact: true }).click();
  await expect(page.getByText('Uploaded successfully', { exact: true })).toHaveCount(2);
  // A fresh cycle tests the second layout through the real upload controls.
  const rawCycleHttp = await request.post(`${api}/projects/${project.id}/cycles`, { data: { name: 'Synthetic raw layout cycle' } });
  expect(rawCycleHttp.status()).toBe(201);
  const rawCycle = await rawCycleHttp.json() as { id: string };
  await navigation.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Select cycle Synthetic raw layout cycle', exact: true }).click();
  await navigation.getByRole('link', { name: 'Upload Reports', exact: true }).click();
  const rawEndpoint = `${api}/cycles/${rawCycle.id}/workbooks`;
  async function rawUpload(title: string, filename: string, status: number) {
    await page.getByLabel(`${title} workbook`, { exact: true }).setInputFiles(resolve(testInfo.outputDir, filename));
    const response = page.waitForResponse((result) => result.url() === rawEndpoint && result.request().method() === 'POST');
    await page.getByRole('button', { name: `Upload ${title}`, exact: true }).click();
    const http = await response;
    expect(http.status()).toBe(status);
    return await http.json() as WorkbookUpload;
  }
  await rawUpload('Post-Upload Report', 'ambiguous-post-upload.xlsx', 422);
  await expect(page.getByRole('alert')).toContainText('exactly one accepted layout');
  expect((await (await request.get(rawEndpoint)).json()).total).toBe(0);
  const rawTransformation = await rawUpload('Transformation Report', 'raw-transformation.xlsx', 201);
  expect(rawTransformation.workbook.row_counts).toEqual({ Detailed_Log: 3 });
  const rawPost = await rawUpload('Post-Upload Report', 'raw-post-upload.xlsx', 201);
  expect(rawPost.workbook.row_counts).toEqual({ Sheet1: 3, Sheet2: 4 });
  expect(rawPost.workbook.warnings).toContainEqual(expect.objectContaining({ code: 'MISSING_OPTIONAL_COLUMNS', count: 4, worksheet_name: 'Sheet1' }));
  const rawObjects = await (await request.get(`${api}/cycles/${rawCycle.id}/upload-objects`)).json() as EvidencePage<UploadObject>;
  expect(rawObjects.total).toBe(3);
  for (const row of rawObjects.items) {
    expect(row.worksheet_name).toBe('Sheet1');
    expect(row.tool_status_raw).toBeNull();
    expect(row.re_upload_raw).toBeNull();
    expect(row.manual_status_raw).toBeNull();
    expect(row.manual_comments_raw).toBeNull();
    expect(Object.keys(row.raw_payload)).toHaveLength(3);
    expect(row.raw_payload).not.toHaveProperty('Status');
  }
  const rawMessages = await (await request.get(`${api}/cycles/${rawCycle.id}/upload-errors`)).json() as EvidencePage<UploadError>;
  expect(rawMessages.items.map((row) => row.sequence_number)).toEqual([1, 2, 7, 11]);
  expect(rawMessages.items.every((row) => row.worksheet_name === 'Sheet2')).toBe(true);
  await expect(page.getByRole('heading', { name: 'Sheet1', exact: true })).toBeVisible();
  const postCard = page.getByRole('region', { name: 'Post-Upload Report', exact: true });
  await postCard.getByText(/Import warnings/).click();
  await expect(postCard.getByText(/Source columns not supplied:/)).toBeVisible();
  expect(errors).toEqual([]);
});
