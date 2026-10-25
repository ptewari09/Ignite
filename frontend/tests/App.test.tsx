import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { navigationItems } from '../src/components/navigation';
import { fixtureApi } from './fixtures/workspace';

function renderApp(path = '/overview') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe('TraceSync application shell', () => {
  it('redirects the root to the honest overview empty state without network calls', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Welcome to TraceSync');
    expect(screen.getByRole('heading', { name: 'No project selected' })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'TraceSync workflow' })).getAllByRole('listitem')).toHaveLength(4);
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(navigation).getAllByRole('link')).toHaveLength(5);
    expect(within(navigation).queryByRole('link', { name: 'Reconciliation' })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: 'Smart Blocker Radar' })).not.toBeInTheDocument();
    expect(screen.queryByText('Traceable by design')).not.toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['/reconciliation', 'Reconciliation'],
    ['/blocker-radar', 'Smart Blocker Radar'],
  ])('preserves the hidden future route %s without advertising it', (path, title) => {
    renderApp(path);
    expect(screen.getByRole('heading', { name: title, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'This screen is not available yet' })).toBeInTheDocument();
    expect(document.title).toBe(`${title} | TraceSync`);
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).not.toHaveTextContent(title);
  });

  it('finishes the guide without creating project progress or making API calls', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Guide step 4: Explore evidence' }));
    await user.click(screen.getByRole('button', { name: 'Finish guide' }));
    expect(screen.getByRole('heading', { name: 'No project selected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart guide' })).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(navigationItems.filter((item) => item.path !== '/overview'))('navigates to $label with one active link', async ({ label }) => {
    fixtureApi([]);
    const user = userEvent.setup();
    renderApp();
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    await user.click(within(navigation).getByRole('link', { name: label }));
    expect(screen.getByRole('heading', { level: 1, name: label })).toBeInTheDocument();
    if (label === 'Projects') expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    else expect(screen.getByRole('heading', { name: 'This screen is not available yet' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: label })).toHaveClass('nav-link-active');
    expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(document.title).toBe(`${label} | TraceSync`);
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('supports direct links and a useful fallback for unknown routes', async () => {
    const user = userEvent.setup();
    renderApp('/unknown-screen');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to overview' }));
    expect(screen.getByRole('heading', { name: 'No project selected' })).toBeInTheDocument();
  });

  it('opens and closes mobile navigation with the correct accessible state', async () => {
    const user = userEvent.setup();
    renderApp();
    const opener = screen.getByRole('button', { name: 'Open navigation' });
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeVisible();
    expect(opener).toHaveAttribute('aria-expanded', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the mobile menu when navigating', async () => {
    fixtureApi([]);
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('link', { name: 'Projects' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Projects', level: 1 })).toBeInTheDocument();
  });

  it('places a working skip link first in keyboard navigation', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content');
  });
});
