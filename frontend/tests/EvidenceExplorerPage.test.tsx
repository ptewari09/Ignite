import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { cycleA, deferred, jsonResponse, projectA } from './fixtures/workspace';
import { workbookFixture } from './fixtures/workbooks';
import { evidenceFixture, evidenceRows } from './fixtures/evidence';

function navigation() { return within(screen.getByRole('navigation', { name: 'Primary navigation' })); }
async function openEvidence() {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/projects']}><App /></MemoryRouter>);
  await user.click(await screen.findByRole('button', { name: `Select project ${projectA.name}` }));
  await user.click(await screen.findByRole('button', { name: `Select cycle ${cycleA.name}` }));
  await user.click(navigation().getByRole('link', { name: 'Evidence Explorer' }));
  return user;
}

describe('Evidence Explorer', () => {
  it('shows a useful empty workspace without making evidence requests', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter initialEntries={['/evidence']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Choose a project and upload cycle' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Projects' })).toHaveAttribute('href', '/projects');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('explains missing workbooks and never invents empty evidence from an absent role', async () => {
    const fixture = evidenceFixture(false, false);
    const user = await openEvidence();
    expect(await screen.findByRole('heading', { name: 'Transformation Report not imported' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Upload Reports' })).toHaveAttribute('href', '/upload-reports');
    await user.click(screen.getByRole('tab', { name: 'Upload Objects' }));
    expect(screen.getByRole('heading', { name: 'Post-Upload Report not imported' })).toBeInTheDocument();
    expect(fixture.requests).toHaveLength(0);
  });

  it('loads only the selected dataset page and preserves duplicate names as distinct rows', async () => {
    const fixture = evidenceFixture();
    await openEvidence();
    expect(await screen.findByText('Records 1–25 of 31')).toBeInTheDocument();
    expect(screen.getAllByText('z_synthetic_order', { exact: false }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Inspect Detailed_LOG row 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inspect Detailed_LOG row 3' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'NO_TLAYER' })).toBeInTheDocument();
    expect(fixture.requests).toHaveLength(1);
    expect(fixture.requests[0]).toMatchObject({ kind: 'transformation-findings', limit: 25, offset: 0 });
    expect(screen.getByRole('tab', { name: 'Transformation Findings' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows full provenance, exact raw padding, normalized identity and the original JSON payload', async () => {
    const fixture = evidenceFixture();
    const original = JSON.stringify(fixture.records.get(cycleA.id));
    const user = await openEvidence();
    const inspect = await screen.findByRole('button', { name: 'Inspect Detailed_LOG row 2' });
    await user.click(inspect);
    const dialog = screen.getByRole('dialog', { name: 'Evidence record details' });
    expect(within(dialog).getByRole('button', { name: 'Close record details' })).toHaveFocus();
    expect(within(dialog).getByText('synthetic-transformation.xlsx')).toBeInTheDocument();
    expect(within(dialog).getByText('" prog  "', { normalizer: (value) => value })).toBeInTheDocument();
    expect(within(dialog).getByText('" z_synthetic_order "')).toBeInTheDocument();
    expect(within(dialog).getByText('Z_SYNTHETIC_ORDER', { exact: true })).toBeInTheDocument();
    expect(within(dialog).getByText('finding-' + cycleA.id + '-0')).toBeInTheDocument();
    await user.click(within(dialog).getByText('Original row payload — all source columns'));
    expect(JSON.parse(within(dialog).getByLabelText('Original row payload').textContent!)).toEqual(fixture.records.get(cycleA.id)!['transformation-findings'][0].raw_payload);
    await user.click(within(dialog).getByRole('button', { name: 'Close record details' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(inspect).toHaveFocus();
    expect(JSON.stringify(fixture.records.get(cycleA.id))).toBe(original);
    expect(fixture.fetch.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });

  it('maps tool fields separately from imported manual annotations', async () => {
    evidenceFixture();
    const user = await openEvidence();
    await user.click(screen.getByRole('tab', { name: 'Upload Objects' }));
    expect(await screen.findByText('Records 1–2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tool status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Imported manual status' })).toBeInTheDocument();
    expect(screen.getAllByRole('cell', { name: 'UPLD_ERROR' })).toHaveLength(2);
    expect(screen.getByRole('cell', { name: 'Uploaded' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inspect Objects row 2' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Imported manual annotations' })).toBeInTheDocument();
    expect(within(dialog).getByText('"UPLD_ERROR"')).toBeInTheDocument();
    expect(within(dialog).getByText('"Uploaded"')).toBeInTheDocument();
    expect(within(dialog).getByText('Post-Upload Report', { exact: false })).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('retains technical messages without identity, zero sequence numbers and raw whitespace', async () => {
    evidenceFixture();
    const user = await openEvidence();
    await user.click(screen.getByRole('tab', { name: 'Upload Errors' }));
    expect(await screen.findByText('Records 1–4 of 4')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '0' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inspect Errors row 3' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('"    "', { normalizer: (value) => value })).toBeInTheDocument();
    expect(within(dialog).getByText('"Fictional component context."')).toBeInTheDocument();
    expect(within(dialog).getAllByLabelText('Not provided')).toHaveLength(3);
    await user.keyboard('{Escape}'); // jsdom does not synthesize native dialog cancel.
    await user.click(within(dialog).getByRole('button', { name: 'Close record details' }));
  });

  it('paginates on the server, resets page filtering and focuses the new dataset heading', async () => {
    const fixture = evidenceFixture();
    const user = await openEvidence();
    await screen.findByText('Records 1–25 of 31');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await user.type(screen.getByRole('searchbox', { name: 'Filter current page' }), 'Z_SYNTH_029');
    expect(screen.getByRole('heading', { name: 'No matches on this page' })).toBeInTheDocument();
    expect(screen.getByText('Records 1–25 of 31 · 0 of 25 loaded records match this page filter')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Records 26–31 of 31')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Z_SYNTH_029' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('heading', { level: 2, name: 'Transformation Findings' })).toHaveFocus();
    expect(fixture.requests.map(({ offset }) => offset)).toEqual([0, 25]);
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('Records 1–25 of 31')).toBeInTheDocument();
  });

  it('distinguishes an imported workbook with zero records from a missing workbook', async () => {
    const fixture = evidenceFixture();
    fixture.records.set(cycleA.id, evidenceRows(cycleA.id, 0));
    await openEvidence();
    expect(await screen.findByRole('heading', { name: 'No records in this dataset' })).toBeInTheDocument();
    expect(screen.queryByText('Transformation Report not imported')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('shows loading while changing pages without retaining stale evidence rows', async () => {
    const fixture = evidenceFixture();
    const user = await openEvidence();
    await screen.findByText('Records 1–25 of 31');
    const pending = deferred<Response>();
    fixture.pageBehavior.page = () => pending.promise;
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Loading transformation findings…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const rows = fixture.records.get(cycleA.id)!['transformation-findings'];
    await act(async () => pending.resolve(jsonResponse({ items: rows.slice(25), total: rows.length, offset: 25, limit: 25 })));
    expect(await screen.findByText('Records 26–31 of 31')).toBeInTheDocument();
  });

  it('retries evidence errors without showing arbitrary source-bearing server messages', async () => {
    const fixture = evidenceFixture();
    fixture.pageBehavior.page = async () => jsonResponse({ error: { code: 'TEST_ERROR', message: 'Sensitive source detail must not appear' }, request_id: 'evidence-test' }, 503);
    const user = await openEvidence();
    expect(await screen.findByRole('alert')).toHaveTextContent('evidence-test');
    expect(screen.queryByText('Sensitive source detail must not appear')).not.toBeInTheDocument();
    delete fixture.pageBehavior.page;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Records 1–25 of 31')).toBeInTheDocument();
  });

  it('retries source metadata when the backend cannot be reached', async () => {
    const fixture = evidenceFixture();
    fixture.behavior.list = () => Promise.reject(new TypeError('Offline'));
    const user = await openEvidence();
    expect(await screen.findByRole('alert')).toHaveTextContent('Check that the backend is running');
    expect(fixture.requests).toHaveLength(0);
    delete fixture.behavior.list;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Records 1–25 of 31')).toBeInTheDocument();
  });

  it('allows an imported role to be browsed while explaining the other missing role', async () => {
    const fixture = evidenceFixture(true, false);
    const user = await openEvidence();
    await screen.findByText('Records 1–25 of 31');
    await user.click(screen.getByRole('tab', { name: 'Upload Errors' }));
    expect(screen.getByRole('heading', { name: 'Post-Upload Report not imported' })).toBeInTheDocument();
    expect(fixture.requests.map((request) => request.kind)).toEqual(['transformation-findings']);
  });

  it('ignores an older tab response and resets pagination when returning to a dataset', async () => {
    const fixture = evidenceFixture();
    const pending = deferred<Response>();
    fixture.pageBehavior.page = () => pending.promise;
    const user = await openEvidence();
    await waitFor(() => expect(fixture.requests).toHaveLength(1));
    const old = fixture.requests[0];
    delete fixture.pageBehavior.page;
    await user.click(screen.getByRole('tab', { name: 'Upload Objects' }));
    expect(await screen.findByText('Records 1–2 of 2')).toBeInTheDocument();
    const rows = fixture.records.get(cycleA.id)!['transformation-findings'];
    await act(async () => pending.resolve(jsonResponse({ items: rows.slice(0, 25), total: rows.length, offset: 0, limit: 25 })));
    expect(old.signal?.aborted).toBe(true);
    expect(screen.getByRole('tab', { name: 'Upload Objects' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('columnheader', { name: 'Error category' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Transformation Findings' }));
    await screen.findByText('Records 1–25 of 31');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Records 26–31 of 31');
    await user.click(screen.getByRole('tab', { name: 'Upload Errors' }));
    await screen.findByText('Records 1–4 of 4');
    await user.click(screen.getByRole('tab', { name: 'Transformation Findings' }));
    expect(await screen.findByText('Records 1–25 of 31')).toBeInTheDocument();
  });

  it('resets dataset, pagination and filters when changing cycles and ignores the older request', async () => {
    const fixture = evidenceFixture();
    const nextCycle = { ...cycleA, id: '00000000-0000-4000-8000-000000000004', name: 'Another evidence cycle' };
    fixture.cycles.push(nextCycle);
    fixture.workbooks.push(workbookFixture('transformation', nextCycle.id));
    fixture.records.set(nextCycle.id, evidenceRows(nextCycle.id, 1));
    const user = await openEvidence();
    await screen.findByText('Records 1–25 of 31');
    const pending = deferred<Response>();
    fixture.pageBehavior.page = () => pending.promise;
    await user.click(screen.getByRole('button', { name: 'Next' }));
    const old = fixture.requests[fixture.requests.length - 1];
    await user.click(navigation().getByRole('link', { name: 'Projects' }));
    await user.click(await screen.findByRole('button', { name: `Select cycle ${nextCycle.name}` }));
    delete fixture.pageBehavior.page;
    await user.click(navigation().getByRole('link', { name: 'Evidence Explorer' }));
    expect(await screen.findByText('Records 1–1 of 1')).toBeInTheDocument();
    await act(async () => pending.resolve(jsonResponse({ items: [], total: 31, limit: 25, offset: 25 })));
    expect(old.signal?.aborted).toBe(true);
    expect(screen.getByRole('tab', { name: 'Transformation Findings' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('supports Arrow/Home/End tab navigation with valid tab-panel relationships', async () => {
    evidenceFixture();
    const user = await openEvidence();
    await screen.findByText('Records 1–25 of 31');
    const tab = screen.getByRole('tab', { name: 'Transformation Findings' });
    tab.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Upload Objects' })).toHaveFocus();
    expect(await screen.findByText('Records 1–2 of 2')).toBeInTheDocument();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Upload Errors' })).toHaveFocus();
    await screen.findByText('Records 1–4 of 4');
    await user.keyboard('{Home}');
    expect(tab).toHaveFocus();
    await screen.findByText('Records 1–25 of 31');
    for (const item of screen.getAllByRole('tab')) expect(document.getElementById(item.getAttribute('aria-controls')!)).toBeInTheDocument();
  });
});
