import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Project, UploadCycle } from '../../src/types/workspace';

// Browser-only fictional fixtures. No backend or confidential files are read.
async function directoryFixture(page: Page) {
  const projects: Project[] = [];
  const cycles: UploadCycle[] = [];
  const posts: { path: string; body: unknown }[] = [];
  const behavior = { failNextList: false, failNextCreate: false, holdCreate: false };
  let release: (() => void) | undefined;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const projectId = url.pathname.match(/\/projects\/([^/]+)\/cycles$/)?.[1];
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { name: string; description?: string | null };
      posts.push({ path: url.pathname, body });
      if (behavior.holdCreate) await new Promise<void>((resolve) => { release = resolve; });
      if (behavior.failNextCreate) {
        behavior.failNextCreate = false;
        await route.fulfill({ status: 422, json: { error: { code: 'VALIDATION_ERROR', message: 'Synthetic validation failure.' }, request_id: 'fixture-post' } });
        return;
      }
      if (projectId) {
        const cycle: UploadCycle = { id: `cycle-${cycles.length}`, project_id: projectId, name: body.name, created_at: '2026-01-02T10:00:00Z', ingestion_status: 'empty' };
        cycles.push(cycle);
        await route.fulfill({ status: 201, json: cycle });
      } else {
        const project: Project = { id: `project-${projects.length}`, name: body.name, description: body.description ?? null, created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' };
        projects.push(project);
        await route.fulfill({ status: 201, json: project });
      }
      return;
    }
    if (behavior.failNextList) {
      behavior.failNextList = false;
      await route.fulfill({ status: 503, json: { error: { code: 'DATABASE_UNAVAILABLE', message: 'Synthetic backend unavailable.' }, request_id: 'fixture-list' } });
      return;
    }
    const rows = projectId ? cycles.filter((cycle) => cycle.project_id === projectId) : projects;
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    await route.fulfill({ json: { items: rows.slice(offset, offset + limit), total: rows.length, limit, offset } });
  });
  return { posts, behavior, releaseCreate: () => release?.() };
}

test('controlled project/cycle workflow updates shared selection and clears incompatible cycles', async ({ page }) => {
  await directoryFixture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/overview');
  await page.getByRole('link', { name: 'View projects' }).click();
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project name', { exact: false }).fill('Synthetic browser Alpha');
  await page.getByLabel('Description', { exact: false }).fill('Controlled fictional fixture');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No upload cycles yet' })).toBeVisible();
  await page.getByRole('button', { name: 'New cycle', exact: true }).click();
  await page.getByLabel('Cycle name', { exact: false }).fill('Browser run 1');
  await page.getByRole('button', { name: 'Create cycle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select cycle Browser run 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: 'Manage workspace: Synthetic browser Alpha / Browser run 1' })).toBeVisible();
  await page.screenshot({ path: 'test-results/projects-desktop.png', fullPage: true, animations: 'disabled' });
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await navigation.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByText('Upload cycle: Browser run 1')).toBeVisible();
  await page.getByRole('link', { name: 'Manage workspace', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select cycle Browser run 1' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project name', { exact: false }).fill('Synthetic browser Beta');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Manage workspace: Synthetic browser Beta / No cycle selected' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select cycle Browser run 1' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Select project Synthetic browser Alpha' }).click();
  await page.getByRole('button', { name: 'Select cycle Browser run 1' }).click();
  await page.getByRole('button', { name: 'Select project Synthetic browser Beta' }).click();
  await expect(page.getByRole('heading', { name: 'No upload cycles yet' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Manage workspace: No project selected' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('controlled failures support retry and prevent duplicate POSTs', async ({ page }) => {
  const fixture = await directoryFixture(page);
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible();
  fixture.behavior.failNextList = true;
  await page.getByRole('button', { name: 'Refresh projects' }).click();
  await expect(page.getByRole('alert')).toContainText('fixture-list');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project name', { exact: false }).fill('Retry browser project');
  fixture.behavior.failNextCreate = true;
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic validation failure.');
  await expect(page.getByLabel('Project name', { exact: false })).toHaveValue('Retry browser project');
  fixture.behavior.holdCreate = true;
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Creating project…' })).toBeDisabled();
  await page.getByRole('form', { name: 'Create project' }).evaluate((form: HTMLFormElement) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(fixture.posts).toHaveLength(2); // One failed attempt, one intentional retry.
  fixture.releaseCreate();
  await expect(page.getByRole('heading', { name: 'Retry browser project', level: 3 })).toBeVisible();
  expect(fixture.posts[1].body).toEqual({ name: 'Retry browser project', description: null });
});

test('320px keyboard forms, long labels and selected workspace remain usable', async ({ page }) => {
  await directoryFixture(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const projectName = `Synthetic mobile ${'M'.repeat(175)}`;
  await expect(page.getByLabel('Project name', { exact: false })).toBeFocused();
  await page.keyboard.type(projectName);
  await page.keyboard.press('Tab');
  await page.keyboard.type('Fictional mobile engagement');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Create project', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'No upload cycles yet' })).toBeVisible();
  await page.getByRole('button', { name: 'New cycle', exact: true }).click();
  await page.keyboard.type(`Mobile ${'C'.repeat(180)}`);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Active cycle', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/projects-320.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Overview', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
