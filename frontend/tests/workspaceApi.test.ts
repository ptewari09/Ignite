import { describe, expect, it, vi } from 'vitest';
import { workspaceApi } from '../src/services/workspaceApi';
import { jsonResponse, projectA, projectB } from './fixtures/workspace';

describe('Workspace collection requests', () => {
  it('follows pagination rather than silently showing only the first page', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [projectA], total: 2, limit: 1, offset: 0 }))
      .mockResolvedValueOnce(jsonResponse({ items: [projectB], total: 2, limit: 1, offset: 1 }));
    vi.stubGlobal('fetch', fetch);
    expect(await workspaceApi.listProjects()).toEqual([projectA, projectB]);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'http://127.0.0.1:8000/api/v1/projects?limit=200&offset=0',
      'http://127.0.0.1:8000/api/v1/projects?limit=200&offset=1',
    ]);
  });

  it('rejects an incomplete collection instead of looping or approving a partial list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 1, limit: 200, offset: 0 })));
    await expect(workspaceApi.listProjects()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('passes cancellation to cycle list requests', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 0, limit: 200, offset: 0 }));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    await workspaceApi.listCycles(projectA.id, controller.signal);
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
