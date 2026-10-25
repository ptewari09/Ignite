import { vi } from 'vitest';
import type { Project, UploadCycle } from '../../src/types/workspace';

export const projectA: Project = { id: '00000000-0000-4000-8000-000000000001', name: 'Synthetic Alpha', description: 'Fictional engagement',
  created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' };
export const projectB: Project = { ...projectA, id: '00000000-0000-4000-8000-000000000002', name: 'Synthetic Beta', description: null };
export const cycleA: UploadCycle = { id: '00000000-0000-4000-8000-000000000003', project_id: projectA.id,
  name: 'Synthetic run 1', created_at: '2026-01-02T10:00:00Z', ingestion_status: 'empty' };

export function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

export function errorResponse(status = 503) {
  return jsonResponse({ error: { code: 'TEST_ERROR', message: 'Synthetic service unavailable.' }, request_id: 'synthetic-request' }, status);
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

export function fixtureApi(initialProjects: Project[] = [projectA, projectB]) {
  const projects = [...initialProjects];
  const cycles = [cycleA];
  const fetch = vi.fn(async (input: string, options?: RequestInit) => {
    const url = new URL(input);
    const cycleProjectId = url.pathname.match(/\/projects\/([^/]+)\/cycles$/)?.[1];
    if (options?.method === 'POST') {
      const body = JSON.parse(options.body as string) as { name: string; description?: string | null };
      if (cycleProjectId) {
        const cycle: UploadCycle = { ...cycleA, ...body, id: `cycle-${cycles.length}`, project_id: cycleProjectId };
        cycles.push(cycle);
        return jsonResponse(cycle, 201);
      }
      const project: Project = { ...projectA, ...body, description: body.description ?? null, id: `project-${projects.length}` };
      projects.push(project);
      return jsonResponse(project, 201);
    }
    const items = cycleProjectId ? cycles.filter((cycle) => cycle.project_id === cycleProjectId) : projects;
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    return jsonResponse({ items: items.slice(offset, offset + limit), total: items.length, limit, offset });
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, projects, cycles };
}
