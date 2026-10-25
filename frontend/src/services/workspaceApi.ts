import { ApiError, apiClient } from './apiClient';
import type { CycleCreate, Page, Project, ProjectCreate, UploadCycle } from '../types/workspace';

// The API caps pages at 200. Read every page so selection is not limited to the
// first page, and only publish a collection once its retrieval has succeeded.
async function listAll<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const items: T[] = [];
  let total: number;
  do {
    const page = await apiClient.request<Page<T>>(`${path}?limit=200&offset=${items.length}`, { signal });
    total = page.total;
    if (!page.items.length && items.length < total) {
      throw new ApiError('The list changed while loading. Refresh to try again.', 'INVALID_RESPONSE', null);
    }
    items.push(...page.items);
  } while (items.length < total);
  return items;
}

export const workspaceApi = {
  listProjects: (signal?: AbortSignal) => listAll<Project>('/projects', signal),
  listCycles: (projectId: string, signal?: AbortSignal) =>
    listAll<UploadCycle>(`/projects/${encodeURIComponent(projectId)}/cycles`, signal),
  createProject: (body: ProjectCreate) => apiClient.request<Project>('/projects', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }),
  createCycle: (projectId: string, body: CycleCreate) =>
    apiClient.request<UploadCycle>(`/projects/${encodeURIComponent(projectId)}/cycles`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
};

export function workspaceError(error: unknown): ApiError {
  return error instanceof ApiError ? error
    : new ApiError('The request could not be completed. Please try again.', 'UNEXPECTED_ERROR', null);
}
