import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { cycleA, deferred, jsonResponse, projectA } from './fixtures/workspace';
import { uploadFixture, workbookFile, workbookFixture } from './fixtures/workbooks';

function navigation() { return within(screen.getByRole('navigation', { name: 'Primary navigation' })); }
function card(title = 'Transformation Report') { return screen.getByRole('region', { name: title }); }
function input(title = 'Transformation Report') { return screen.getByLabelText(`${title} workbook`); }
function renderUploadEmpty() { render(<MemoryRouter initialEntries={['/upload-reports']}><App /></MemoryRouter>); }

async function openWorkspace(selectCycle = true) {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/projects']}><App /></MemoryRouter>);
  await user.click(await screen.findByRole('button', { name: `Select project ${projectA.name}` }));
  await screen.findByRole('button', { name: `Select cycle ${cycleA.name}` });
  if (selectCycle) await user.click(screen.getByRole('button', { name: `Select cycle ${cycleA.name}` }));
  await user.click(navigation().getByRole('link', { name: 'Upload Reports' }));
  return user;
}

function select(file = workbookFile(), title = 'Transformation Report') {
  fireEvent.change(input(title), { target: { files: [file] } });
}

describe('Upload Reports', () => {
  it('shows an honest empty workspace with two disabled cards and a working Projects link', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    renderUploadEmpty();
    expect(screen.getByRole('heading', { name: 'Choose a project and upload cycle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload Transformation Report' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Upload Post-Upload Report' })).toBeDisabled();
    expect(input()).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Go to Projects' })).toHaveAttribute('href', '/projects');
    expect(screen.getAllByRole('form')).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires cycle selection even when a project is selected', async () => {
    uploadFixture();
    await openWorkspace(false);
    expect(screen.getByText('No cycle selected', { selector: 'dd' })).toBeInTheDocument();
    expect(input()).toBeDisabled();
  });

  it('checks existing workbooks before enabling upload or claiming a role is empty', async () => {
    const fixture = uploadFixture();
    const pending = deferred<Response>();
    fixture.behavior.list = () => pending.promise;
    await openWorkspace();
    expect(screen.getByText('Checking saved reports…')).toHaveAttribute('role', 'status');
    expect(screen.queryByText('Not uploaded')).not.toBeInTheDocument();
    expect(input()).toBeDisabled();
    await act(async () => pending.resolve(jsonResponse({ items: [], total: 0, limit: 200, offset: 0 })));
    expect(await screen.findAllByText('Not uploaded')).toHaveLength(2);
  });

  it('loads actual import counts, zero counts, timestamps and warning metadata', async () => {
    const saved = workbookFixture();
    saved.row_counts.Detailed_LOG = 0;
    uploadFixture([saved, workbookFixture('post_upload')]);
    const user = await openWorkspace();
    expect(await screen.findAllByText('Uploaded successfully')).toHaveLength(2);
    expect(within(card()).getByText(saved.original_filename)).toBeInTheDocument();
    expect(within(card()).getByText('0', { selector: 'strong' })).toBeInTheDocument();
    expect(within(card()).getByText('1 distinct normalized names')).toBeInTheDocument();
    expect(within(card()).getByText('ingested')).toBeInTheDocument();
    expect(card().querySelector('time')).toHaveAttribute('dateTime', saved.uploaded_at);
    await user.click(within(card()).getByText('Import warnings (1)'));
    expect(within(card()).getByText('Rows with blank object names were preserved.')).toBeVisible();
    expect(within(card()).getByText('Detailed_LOG · Occurrences: 1')).toBeVisible();
  });

  it('accepts uppercase XLSX, shows file metadata and supports clearing/changing selection', async () => {
    uploadFixture();
    const user = await openWorkspace();
    await waitFor(() => expect(input()).toBeEnabled());
    select(workbookFile('SYNTHETIC.XLSX'));
    expect(within(card()).getByText('SYNTHETIC.XLSX')).toBeInTheDocument();
    expect(within(card()).getByRole('button', { name: 'Change file for Transformation Report' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear file for Transformation Report' }));
    expect(screen.getByRole('button', { name: 'Choose file for Transformation Report' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Upload Transformation Report' })).toBeDisabled();
    select(workbookFile('new-name.xlsx'));
    expect(within(card()).getByText('new-name.xlsx')).toBeInTheDocument();
  });

  it('rejects unsupported selections and clears a previously valid file', async () => {
    const fixture = uploadFixture();
    await openWorkspace();
    await waitFor(() => expect(input()).toBeEnabled());
    select();
    select(workbookFile('legacy.xls'));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an .xlsx workbook');
    expect(screen.getByRole('button', { name: 'Upload Transformation Report' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Clear file for Transformation Report' })).not.toBeInTheDocument();
    expect(fixture.attempts).toHaveLength(0);
  });

  it('rejects empty and oversized files before any upload request', async () => {
    const fixture = uploadFixture();
    await openWorkspace();
    await waitFor(() => expect(input()).toBeEnabled());
    select(new File([], 'empty.xlsx'));
    expect(screen.getByRole('alert')).toHaveTextContent('file is empty');
    const large = workbookFile('large.xlsx');
    Object.defineProperty(large, 'size', { value: 20 * 1024 * 1024 + 1 });
    select(large);
    expect(screen.getByRole('alert')).toHaveTextContent('exceeds the 20 MiB upload limit');
    expect(fixture.attempts).toHaveLength(0);
  });

  it('supports dropping one file and rejects a multi-file drop', async () => {
    uploadFixture();
    await openWorkspace();
    await waitFor(() => expect(input()).toBeEnabled());
    const zone = card().querySelector('.file-dropzone')!;
    fireEvent.drop(zone, { dataTransfer: { files: [workbookFile('dropped.xlsx')] } });
    expect(within(card()).getByText('dropped.xlsx')).toBeInTheDocument();
    fireEvent.drop(zone, { dataTransfer: { files: [workbookFile(), workbookFile('second.xlsx')] } });
    expect(screen.getByRole('alert')).toHaveTextContent('one workbook at a time');
    expect(screen.getByRole('button', { name: 'Upload Transformation Report' })).toBeDisabled();
  });

  it('posts exact multipart fields without a Content-Type boundary and releases the selected file', async () => {
    const fixture = uploadFixture();
    const user = await openWorkspace();
    await waitFor(() => expect(input()).toBeEnabled());
    const file = workbookFile();
    select(file);
    await user.click(screen.getByRole('button', { name: 'Upload Transformation Report' }));
    expect(await screen.findByText('Import successful. Saved record counts and warnings are shown above.')).toBeInTheDocument();
    const sent = fixture.attempts[0];
    expect(sent.cycleId).toBe(cycleA.id);
    expect(sent.role).toBe('transformation');
    expect(sent.file.name).toBe(file.name);
    expect(Array.from((sent.options?.body as FormData).keys())).toEqual(['role', 'file']);
    expect(new Headers(sent.options?.headers).has('Content-Type')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Clear file for Transformation Report' })).not.toBeInTheDocument();
    expect(input()).toHaveValue('');
    expect(within(card()).getByText('3', { selector: 'strong' })).toBeInTheDocument();
  });

  it('uploads the post-upload role independently and presents both worksheet counts', async () => {
    const fixture = uploadFixture();
    const user = await openWorkspace();
    await waitFor(() => expect(input('Post-Upload Report')).toBeEnabled());
    select(workbookFile('synthetic-post-upload.xlsx'), 'Post-Upload Report');
    await user.click(screen.getByRole('button', { name: 'Upload Post-Upload Report' }));
    expect(await within(card('Post-Upload Report')).findByText('Uploaded successfully')).toBeInTheDocument();
    expect(fixture.attempts[0].role).toBe('post_upload');
    expect(within(card('Post-Upload Report')).getByText('3', { selector: 'strong' })).toBeInTheDocument();
    expect(within(card('Post-Upload Report')).getByText('4', { selector: 'strong' })).toBeInTheDocument();
  });

  it('shows duplicate feedback while retaining the original import and record counts', async () => {
    const saved = workbookFixture();
    const fixture = uploadFixture([saved]);
    const user = await openWorkspace();
    await waitFor(() => expect(input()).toBeEnabled());
    select();
    await user.click(screen.getByRole('button', { name: 'Check duplicate Transformation Report' }));
    expect(await screen.findByText(/Duplicate re-upload: this workbook was already imported/)).toBeInTheDocument();
    expect(fixture.workbooks).toHaveLength(1);
    expect(card().querySelector('time')).toHaveAttribute('dateTime', saved.uploaded_at);
    await user.click(navigation().getByRole('link', { name: 'Overview' }));
    await user.click(navigation().getByRole('link', { name: 'Upload Reports' }));
    expect(await within(card()).findByText('Uploaded successfully')).toBeInTheDocument();
    expect(screen.queryByText(/Duplicate re-upload:/)).not.toBeInTheDocument();
  });

  it('handles a 409 conflict without replacing or hiding the original workbook', async () => {
    const saved = workbookFixture();
    const fixture = uploadFixture([saved]);
    const user = await openWorkspace();
    await waitFor(() => expect(input()).toBeEnabled());
    select(workbookFile('different.xlsx'));
    await user.click(screen.getByRole('button', { name: 'Check duplicate Transformation Report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already contains a different workbook');
    await waitFor(() => expect(input()).toBeEnabled());
    expect(fixture.workbooks).toEqual([saved]);
    expect(within(card()).getByText(saved.original_filename)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('synthetic-conflict');
  });

  it.each([
    [422, 'MISSING_WORKSHEETS', 'Required worksheets are missing'],
    [422, 'MISSING_COLUMNS', 'Required columns are missing'],
    [422, 'INVALID_WORKBOOK', 'not a supported, readable workbook'],
    [413, 'UPLOAD_TOO_LARGE', 'exceeds a server file-size'],
    [415, 'UNSUPPORTED_FILE_TYPE', 'file type is unsupported'],
  ])('handles HTTP %i / %s without displaying worksheet contents', async (status, code, message) => {
    const fixture = uploadFixture();
    fixture.behavior.upload = async () => jsonResponse({ error: { code, message: 'Sensitive worksheet text must not appear.' }, request_id: 'synthetic-error' }, status);
    const user = await openWorkspace();
    await waitFor(() => expect(input()).toBeEnabled());
    select();
    await user.click(screen.getByRole('button', { name: 'Upload Transformation Report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('alert')).toHaveTextContent('synthetic-error');
    expect(screen.queryByText('Sensitive worksheet text must not appear.')).not.toBeInTheDocument();
    expect(fixture.workbooks).toHaveLength(0);
    expect(screen.queryByText('Uploaded successfully')).not.toBeInTheDocument();
  });

  it('retries workbook listing when the backend is unavailable', async () => {
    const fixture = uploadFixture();
    fixture.behavior.list = () => Promise.reject(new TypeError('Offline'));
    const user = await openWorkspace();
    expect(await screen.findByRole('alert')).toHaveTextContent('Check that the backend is running');
    expect(input()).toBeDisabled();
    delete fixture.behavior.list;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(input()).toBeEnabled());
    expect(screen.getAllByText('Not uploaded')).toHaveLength(2);
  });

  it('treats a lost upload response as unknown and rechecks saved data without an automatic POST retry', async () => {
    const fixture = uploadFixture();
    fixture.behavior.upload = () => Promise.reject(new TypeError('Offline'));
    const user = await openWorkspace();
    await waitFor(() => expect(input()).toBeEnabled());
    select();
    await user.click(screen.getByRole('button', { name: 'Upload Transformation Report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload not confirmed');
    expect(screen.getByRole('alert')).toHaveTextContent('outcome may be unknown');
    expect(within(card()).getByText('Upload outcome is unconfirmed. Refresh saved reports.')).toBeInTheDocument();
    fixture.workbooks.push(workbookFixture());
    await user.click(screen.getByRole('button', { name: 'Refresh saved reports' }));
    expect(await screen.findByText('Uploaded successfully')).toBeInTheDocument();
    expect(fixture.attempts).toHaveLength(1);
  });

  it('blocks duplicate submits while the upload is pending', async () => {
    const fixture = uploadFixture();
    const pending = deferred<Response>();
    fixture.behavior.upload = () => pending.promise;
    await openWorkspace();
    await waitFor(() => expect(input()).toBeEnabled());
    select();
    const form = screen.getByRole('form', { name: 'Upload Transformation Report' });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fixture.attempts).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Upload Transformation Report' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh saved reports' })).toBeDisabled();
    await act(async () => pending.resolve(jsonResponse({ workbook: workbookFixture(), duplicate: false }, 201)));
    expect(await screen.findByText('Uploaded successfully')).toBeInTheDocument();
  });

  it('aborts the browser request and clears stale files/results when changing cycles mid-upload', async () => {
    const fixture = uploadFixture();
    const cycleB = { ...cycleA, id: '00000000-0000-4000-8000-000000000004', name: 'Synthetic run 2' };
    fixture.cycles.push(cycleB);
    const pending = deferred<Response>();
    fixture.behavior.upload = () => pending.promise;
    const user = await openWorkspace();
    await waitFor(() => expect(input()).toBeEnabled());
    select();
    await user.click(screen.getByRole('button', { name: 'Upload Transformation Report' }));
    const originalRequest = fixture.attempts[0];
    await user.click(navigation().getByRole('link', { name: 'Projects' }));
    expect(originalRequest.signal?.aborted).toBe(true);
    await user.click(await screen.findByRole('button', { name: `Select cycle ${cycleB.name}` }));
    await user.click(navigation().getByRole('link', { name: 'Upload Reports' }));
    await waitFor(() => expect(input()).toBeEnabled());
    await act(async () => pending.resolve(jsonResponse({ workbook: workbookFixture(), duplicate: false }, 201)));
    expect(screen.getByText(cycleB.name, { selector: 'dd' })).toBeInTheDocument();
    expect(screen.queryByText('Uploaded successfully')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear file for Transformation Report' })).not.toBeInTheDocument();
    expect(originalRequest.cycleId).toBe(cycleA.id);
    expect(fixture.attempts).toHaveLength(1);
  });
});
