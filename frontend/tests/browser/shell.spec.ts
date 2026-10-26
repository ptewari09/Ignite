import { expect, test } from '../support/safeBrowser';

const routes = [
  ['Projects', '/projects'],
  ['Upload Reports', '/upload-reports'],
  ['Evidence Explorer', '/evidence'],
  ['Customer Reports', '/customer-reports'],
];

test.beforeEach(async ({ page }) => {
  // Shell checks use a controlled empty directory, independently of FastAPI.
  await page.route('**/api/v1/projects?**', (route) => route.fulfill({
    json: { items: [], total: 0, limit: 200, offset: 0 },
  }));
});

test('desktop shell renders, all links navigate, and direct routes survive reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  const apiRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (request.url().includes('/api/v1')) apiRequests.push(request.url()); });
  await page.goto('/');
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('heading', { name: 'No project selected' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link')).toHaveCount(5);
  await expect(navigation.getByRole('link', { name: 'Reconciliation' })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Smart Blocker Radar' })).toHaveCount(0);
  await expect(page.getByText('Traceable by design')).toHaveCount(0);
  const overview = navigation.getByRole('link', { name: 'Overview', exact: true });
  await expect(overview).toHaveAttribute('aria-current', 'page');
  const inactiveBackground = await navigation.getByRole('link', { name: 'Projects', exact: true }).evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect.poll(() => overview.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(inactiveBackground);
  for (const [name, path] of routes) {
    await navigation.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(path + '$'));
    await expect(page.getByRole('heading', { name, level: 1, exact: true })).toBeVisible();
    if (path === '/projects') await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible();
    else if (path === '/upload-reports') await expect(page.getByRole('heading', { name: 'Choose a project and upload cycle' })).toBeVisible();
    else if (path === '/evidence') await expect(page.getByRole('heading', { name: 'Choose a project and upload cycle' })).toBeVisible();
    else await expect(page.getByRole('heading', { name: 'This screen is not available yet' })).toBeVisible();
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(navigation.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Customer Reports', level: 1 })).toBeVisible();
  await overview.click();
  await expect(overview).toHaveAttribute('aria-current', 'page');
  await page.mouse.move(900, 80);
  await page.screenshot({ path: 'test-results/overview-desktop.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
  expect(apiRequests.length).toBeGreaterThan(0);
  expect(apiRequests.every((url) => new URL(url).pathname === '/api/v1/projects')).toBe(true);
});

test('mobile dialog traps focus, closes with Escape/backdrop/navigation, and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/overview');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeHidden();
  const opener = page.getByRole('button', { name: 'Open navigation' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Navigation menu' });
  await expect(dialog).toBeVisible();
  await expect(opener).toHaveAttribute('aria-expanded', 'true');
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: 'test-results/navigation-mobile.png', fullPage: true, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  await opener.click();
  await dialog.getByRole('button', { name: 'Close navigation' }).click();
  await expect(dialog).toBeHidden();
  await opener.click();
  await page.mouse.click(370, 400);
  await expect(dialog).toBeHidden();
  await opener.click();
  await dialog.getByRole('link', { name: 'Evidence Explorer' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Evidence Explorer', level: 1 })).toBeVisible();
  await page.goto('/overview');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/overview-mobile.png', fullPage: true, animations: 'disabled' });
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/reconciliation');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const title = await page.locator('.header-title').boundingBox();
    const context = await page.locator('.project-context').boundingBox();
    expect(title && context && title.x + title.width <= context.x).toBeTruthy();
  }
});

test('keyboard skip link reaches content and a mobile menu closes on desktop resize', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/overview');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('hidden future routes remain available without sidebar entries', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [path, title] of [['/reconciliation', 'Reconciliation'], ['/blocker-radar', 'Smart Blocker Radar']]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page).toHaveTitle(`${title} | TraceSync`);
    await expect(page.getByRole('heading', { name: 'This screen is not available yet' })).toBeVisible();
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    await expect(navigation.getByRole('link', { name: title })).toHaveCount(0);
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  }
});

test('guide navigation, skip, restart and focus affect only the walkthrough', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const apiRequests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/api/v1')) apiRequests.push(request.url()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/overview');
  const guide = page.getByRole('region', { name: 'Getting started', exact: true });
  const progress = guide.getByRole('progressbar', { name: 'Guide progress' });
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(guide.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(guide.getByRole('heading', { name: 'Create an upload cycle' })).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '2');
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(guide.getByRole('heading', { name: 'Upload source reports' })).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '3');
  await guide.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '2');
  const evidence = guide.getByRole('button', { name: 'Guide step 4: Explore evidence' });
  await evidence.focus();
  await page.keyboard.press('Enter');
  await expect(guide.getByRole('heading', { name: 'Explore evidence' })).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '4');
  await page.screenshot({ path: 'test-results/guide-evidence-desktop.png', fullPage: true, animations: 'disabled' });
  await guide.getByRole('button', { name: 'Finish guide' }).click();
  await expect(guide.getByRole('button', { name: 'Restart guide' })).toBeFocused();
  await expect(progress).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No project selected' })).toBeVisible();
  await page.screenshot({ path: 'test-results/guide-collapsed-desktop.png', fullPage: true, animations: 'disabled' });
  await guide.getByRole('button', { name: 'Restart guide' }).click();
  await expect(guide.getByRole('heading', { name: 'Create a project' })).toBeFocused();
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await guide.getByRole('button', { name: 'Skip guide' }).click();
  await expect(guide.getByRole('button', { name: 'Reopen guide' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(page.getByRole('heading', { name: 'No project selected' })).toBeVisible();
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('onboarding remains usable at narrow widths and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/overview');
    await expect(page.getByRole('heading', { name: 'Welcome to TraceSync' })).toBeVisible();
    const guide = page.getByRole('region', { name: 'Getting started', exact: true });
    await guide.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(guide.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const transition = await guide.locator('.guide-progress-track > span').evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(parseFloat(transition)).toBeLessThan(0.001);
    if (width === 320) await page.screenshot({ path: 'test-results/guide-narrow.png', fullPage: true, animations: 'disabled' });
    await guide.getByRole('button', { name: 'Skip guide' }).click();
    await expect(guide.getByRole('button', { name: 'Reopen guide' })).toBeVisible();
    await guide.getByRole('button', { name: 'Reopen guide' }).click();
    await expect(guide.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
