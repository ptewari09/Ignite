import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { cycleA, deferred, errorResponse, fixtureApi, jsonResponse, projectA, projectB } from './fixtures/workspace';

function renderProjects() {
  return render(<MemoryRouter initialEntries={['/projects']}><App /></MemoryRouter>);
}

async function selectAlpha() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: `Select project ${projectA.name}` }));
  await screen.findByRole('button', { name: `Select cycle ${cycleA.name}` });
  return user;
}

describe('Projects and upload cycles', () => {
  it('shows loading instead of an empty list while the request is pending', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn(() => pending.promise));
    renderProjects();
    expect(screen.getByText('Loading projects…')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: 'New project' })).toBeDisabled();
    expect(screen.queryByText('No projects yet')).not.toBeInTheDocument();
    await act(async () => pending.resolve(jsonResponse({ items: [], total: 0, limit: 200, offset: 0 })));
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('renders the empty state and creates a project from the real request fields', async () => {
    const api = fixtureApi([]);
    const user = userEvent.setup();
    renderProjects();
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New project' }));
    const input = screen.getByLabelText('Project name', { exact: false });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('maxLength', '200');
    await user.type(input, '  Fictional pilot  ');
    await user.type(screen.getByLabelText('Description', { exact: false }), 'Synthetic description');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('heading', { name: 'Fictional pilot', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('Project “Fictional pilot” created and selected.')).toBeInTheDocument();
    expect(await screen.findByText('No upload cycles yet')).toBeInTheDocument();
    const post = api.fetch.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ name: 'Fictional pilot', description: 'Synthetic description' });
    expect(screen.getByRole('link', { name: 'Manage workspace: Fictional pilot / No cycle selected' })).toBeInTheDocument();
  });

  it('preserves form input after a creation failure and permits a deliberate retry', async () => {
    const { fetch } = fixtureApi();
    const user = userEvent.setup();
    renderProjects();
    await user.click(await screen.findByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Project name', { exact: false }), 'Retry pilot');
    fetch.mockResolvedValueOnce(errorResponse(422));
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Synthetic service unavailable.');
    expect(screen.getByRole('alert')).toHaveTextContent('synthetic-request');
    expect(screen.getByLabelText('Project name', { exact: false })).toHaveValue('Retry pilot');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Retry pilot' })).toBeInTheDocument();
  });

  it('prevents duplicate submissions while creation is in flight', async () => {
    const { fetch } = fixtureApi();
    const pending = deferred<Response>();
    const user = userEvent.setup();
    renderProjects();
    await user.click(await screen.findByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Project name', { exact: false }), 'Single submission');
    fetch.mockImplementationOnce(() => pending.promise);
    const form = screen.getByRole('form', { name: 'Create project' });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Creating project…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await act(async () => pending.resolve(jsonResponse({ ...projectA, id: 'created', name: 'Single submission' }, 201)));
    expect(await screen.findByRole('heading', { level: 3, name: 'Single submission' })).toBeInTheDocument();
  });

  it('rejects whitespace names and exposes field limits without sending a POST', async () => {
    const { fetch } = fixtureApi();
    const user = userEvent.setup();
    renderProjects();
    await user.click(await screen.findByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Project name', { exact: false }), '   ');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(screen.getByRole('alert')).toHaveTextContent('at least one non-space character');
    expect(screen.getByLabelText('Project name', { exact: false })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Description', { exact: false })).toHaveAttribute('maxLength', '4000');
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  });

  it('does not duplicate a created row already returned by a concurrent refresh', async () => {
    const { fetch } = fixtureApi([]);
    const user = userEvent.setup();
    renderProjects();
    await screen.findByText('No projects yet');
    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Project name', { exact: false }), projectA.name);
    const listRead = deferred<Response>();
    const createResponse = deferred<Response>();
    fetch.mockImplementationOnce(() => listRead.promise).mockImplementationOnce(() => createResponse.promise);
    await user.click(screen.getByRole('button', { name: 'Refresh projects' }));
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    await act(async () => listRead.resolve(jsonResponse({ items: [projectA], total: 1, offset: 0, limit: 200 })));
    await act(async () => createResponse.resolve(jsonResponse(projectA, 201)));
    expect(screen.getAllByRole('heading', { level: 3, name: projectA.name })).toHaveLength(1);
  });

  it('lists cycles, selects an active workspace and retains it across navigation', async () => {
    fixtureApi();
    renderProjects();
    const user = await selectAlpha();
    await user.click(screen.getByRole('button', { name: `Select cycle ${cycleA.name}` }));
    expect(screen.getByRole('button', { name: `Select cycle ${cycleA.name}` })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: `Manage workspace: ${projectA.name} / ${cycleA.name}` })).toBeInTheDocument();
    const navigation = within(screen.getByRole('navigation', { name: 'Primary navigation' }));
    await user.click(navigation.getByRole('link', { name: 'Overview' }));
    expect(screen.getByText(`Upload cycle: ${cycleA.name}`)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Manage workspace' }));
    expect(await screen.findByRole('button', { name: `Select cycle ${cycleA.name}` })).toHaveAttribute('aria-pressed', 'true');
  });

  it('creates and selects a cycle with only its supported name field', async () => {
    const { fetch } = fixtureApi();
    renderProjects();
    const user = await selectAlpha();
    await user.click(screen.getByRole('button', { name: 'New cycle' }));
    await user.type(screen.getByLabelText('Cycle name', { exact: false }), 'Run two');
    await user.click(screen.getByRole('button', { name: 'Create cycle' }));
    expect(await screen.findByRole('button', { name: 'Select cycle Run two' })).toHaveAttribute('aria-pressed', 'true');
    const post = fetch.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(post?.[0]).toContain(`/projects/${projectA.id}/cycles`);
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ name: 'Run two' });
    expect(screen.getByRole('link', { name: `Manage workspace: ${projectA.name} / Run two` })).toBeInTheDocument();
    expect(screen.getAllByText('empty')).toHaveLength(2);
  });

  it('clears the active cycle when selecting a different project', async () => {
    fixtureApi();
    renderProjects();
    const user = await selectAlpha();
    await user.click(screen.getByRole('button', { name: `Select cycle ${cycleA.name}` }));
    await user.click(screen.getByRole('button', { name: `Select project ${projectB.name}` }));
    expect(await screen.findByText('No upload cycles yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `Manage workspace: ${projectB.name} / No cycle selected` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Select cycle ${cycleA.name}` })).not.toBeInTheDocument();
  });

  it('does not apply a stale cycle list after switching projects', async () => {
    const { fetch } = fixtureApi();
    const pending = deferred<Response>();
    const user = userEvent.setup();
    renderProjects();
    await screen.findByRole('button', { name: `Select project ${projectA.name}` });
    fetch.mockImplementationOnce(() => pending.promise);
    await user.click(screen.getByRole('button', { name: `Select project ${projectA.name}` }));
    await user.click(screen.getByRole('button', { name: `Select project ${projectB.name}` }));
    expect(await screen.findByText('No upload cycles yet')).toBeInTheDocument();
    await act(async () => pending.resolve(jsonResponse({ items: [cycleA], total: 1, offset: 0, limit: 200 })));
    expect(screen.queryByRole('button', { name: `Select cycle ${cycleA.name}` })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: `Manage workspace: ${projectB.name} / No cycle selected` })).toBeInTheDocument();
  });

  it('does not select a late cycle creation response belonging to the previous project', async () => {
    const { fetch } = fixtureApi();
    renderProjects();
    const user = await selectAlpha();
    await user.click(screen.getByRole('button', { name: 'New cycle' }));
    await user.type(screen.getByLabelText('Cycle name', { exact: false }), 'Late cycle');
    const pending = deferred<Response>();
    fetch.mockImplementationOnce(() => pending.promise);
    await user.click(screen.getByRole('button', { name: 'Create cycle' }));
    await user.click(screen.getByRole('button', { name: `Select project ${projectB.name}` }));
    await screen.findByText('No upload cycles yet');
    await act(async () => pending.resolve(jsonResponse({ ...cycleA, id: 'late-cycle', name: 'Late cycle' }, 201)));
    expect(screen.getByRole('link', { name: `Manage workspace: ${projectB.name} / No cycle selected` })).toBeInTheDocument();
  });

  it('retries an unavailable project list and supports explicit refresh', async () => {
    const { fetch } = fixtureApi();
    fetch.mockRejectedValueOnce(new TypeError('Offline'));
    const user = userEvent.setup();
    renderProjects();
    expect(await screen.findByRole('alert')).toHaveTextContent('Check that the backend is running');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('button', { name: `Select project ${projectA.name}` });
    await user.click(screen.getByRole('button', { name: 'Refresh projects' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh projects' })).toBeEnabled());
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('retries cycle list failures and preserves failed cycle creation input', async () => {
    const { fetch } = fixtureApi();
    const user = userEvent.setup();
    renderProjects();
    await screen.findByRole('button', { name: `Select project ${projectA.name}` });
    fetch.mockResolvedValueOnce(errorResponse());
    await user.click(screen.getByRole('button', { name: `Select project ${projectA.name}` }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load upload cycles');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('button', { name: `Select cycle ${cycleA.name}` });
    await user.click(screen.getByRole('button', { name: 'New cycle' }));
    await user.type(screen.getByLabelText('Cycle name', { exact: false }), 'Retry run');
    fetch.mockResolvedValueOnce(errorResponse(422));
    await user.click(screen.getByRole('button', { name: 'Create cycle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create cycle');
    expect(screen.getByLabelText('Cycle name', { exact: false })).toHaveValue('Retry run');
    await user.click(screen.getByRole('button', { name: 'Create cycle' }));
    expect(await screen.findByRole('button', { name: 'Select cycle Retry run' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clears a selection no longer present in a refreshed server list', async () => {
    const { projects } = fixtureApi();
    renderProjects();
    const user = await selectAlpha();
    await user.click(screen.getByRole('button', { name: `Select cycle ${cycleA.name}` }));
    projects.splice(0, 1);
    await user.click(screen.getByRole('button', { name: 'Refresh projects' }));
    expect(await screen.findByRole('link', { name: 'Manage workspace: No project selected' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Select a project to view cycles' })).toBeInTheDocument();
  });

  it('clears a cycle no longer present on the server without changing its project', async () => {
    const { cycles } = fixtureApi();
    renderProjects();
    const user = await selectAlpha();
    await user.click(screen.getByRole('button', { name: `Select cycle ${cycleA.name}` }));
    cycles.splice(0);
    await user.click(screen.getByRole('button', { name: 'Refresh cycles' }));
    expect(await screen.findByText('No upload cycles yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `Manage workspace: ${projectA.name} / No cycle selected` })).toBeInTheDocument();
  });

  it('invalidates a selected project if its cycle endpoint returns not found', async () => {
    const { fetch } = fixtureApi();
    renderProjects();
    const user = await selectAlpha();
    fetch.mockResolvedValueOnce(errorResponse(404));
    await user.click(screen.getByRole('button', { name: 'Refresh cycles' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load projects');
    expect(screen.getByRole('link', { name: 'Manage workspace: No project selected' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Select project ${projectA.name}` })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: `Select project ${projectA.name}` })).toBeInTheDocument();
  });

  it('restores keyboard focus after cancelling an inline form without creating a record', async () => {
    const { fetch } = fixtureApi([]);
    const user = userEvent.setup();
    renderProjects();
    await screen.findByText('No projects yet');
    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Project name', { exact: false }), 'Unsaved name');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'New project' })).toHaveFocus();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  });
});
