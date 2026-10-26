import type { Workbook, WorkbookRole } from '../../src/types/workbook';
import { cycleA, fixtureApi, jsonResponse } from './workspace';

export function workbookFixture(role: WorkbookRole = 'transformation', cycleId = cycleA.id): Workbook {
  return { id: `synthetic-${cycleId}-${role}`, cycle_id: cycleId, role,
    original_filename: role === 'transformation' ? 'synthetic-transformation.xlsx' : 'synthetic-post-upload.xlsx',
    sha256: 'a'.repeat(64), byte_size: 5120, uploaded_at: '2026-01-03T10:00:00Z', ingestion_status: 'ingested',
    sheets_found: role === 'transformation' ? ['Detailed_LOG'] : ['Objects', 'Errors'],
    row_counts: role === 'transformation' ? { Detailed_LOG: 3 } : { Objects: 3, Errors: 4 },
    object_counts: role === 'transformation' ? { Detailed_LOG: 1 } : { Objects: 2, Errors: 2 },
    warnings: [{ code: 'BLANK_OBJECT_NAME', message: 'Rows with blank object names were preserved.', worksheet_name: role === 'transformation' ? 'Detailed_LOG' : 'Errors', count: 1 }],
  };
}

export function workbookFile(name = 'synthetic-transformation.xlsx') {
  // File-selection fixtures only. Browser code never parses these fictional bytes.
  // Live browser tests generate genuine synthetic XLSX files with openpyxl.
  return new File(['fictional selection fixture'], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function uploadFixture(initialWorkbooks: Workbook[] = []) {
  const base = fixtureApi();
  const projectFetch = base.fetch.getMockImplementation()!;
  const workbooks = [...initialWorkbooks];
  const attempts: { cycleId: string; role: WorkbookRole; file: File; signal: AbortSignal | null | undefined; options?: RequestInit }[] = [];
  const behavior: {
    list?: () => Promise<Response>;
    upload?: () => Promise<Response>;
  } = {};
  base.fetch.mockImplementation(async (input: string, options?: RequestInit) => {
    const url = new URL(input);
    const cycleId = url.pathname.match(/\/cycles\/([^/]+)\/workbooks$/)?.[1];
    if (!cycleId) return projectFetch(input, options);
    if (options?.method === 'POST') {
      const body = options.body as FormData;
      const role = body.get('role') as WorkbookRole;
      const file = body.get('file') as File;
      attempts.push({ cycleId, role, file, signal: options.signal, options });
      if (behavior.upload) return behavior.upload();
      const existing = workbooks.find((item) => item.role === role && item.cycle_id === cycleId);
      if (existing && existing.original_filename !== file.name) return jsonResponse({ error: { code: 'WORKBOOK_ROLE_OCCUPIED', message: 'Synthetic conflict.' }, request_id: 'synthetic-conflict' }, 409);
      const workbook = existing ?? { ...workbookFixture(role, cycleId), original_filename: file.name, byte_size: file.size };
      if (!existing) workbooks.push(workbook);
      return jsonResponse({ workbook, duplicate: !!existing }, existing ? 200 : 201);
    }
    if (behavior.list) return behavior.list();
    const items = workbooks.filter((item) => item.cycle_id === cycleId);
    return jsonResponse({ items, total: items.length, limit: 200, offset: 0 });
  });
  return { ...base, workbooks, attempts, behavior };
}
