import { ApiError, apiClient } from './apiClient';
import type { Page } from '../types/workspace';
import type { Workbook, WorkbookRole, WorkbookUpload } from '../types/workbook';

function validRole(role: string): role is WorkbookRole {
  return role === 'transformation' || role === 'post_upload';
}

export const workbookApi = {
  async list(cycleId: string, signal?: AbortSignal): Promise<Workbook[]> {
    const workbooks: Workbook[] = [];
    let total: number;
    do {
      const page = await apiClient.request<Page<Workbook>>(
        `/cycles/${encodeURIComponent(cycleId)}/workbooks?limit=200&offset=${workbooks.length}`, { signal },
      );
      total = page.total;
      if ((!page.items.length && workbooks.length < total)
        || page.items.some((item) => item.cycle_id !== cycleId || !validRole(item.role))) {
        throw new ApiError('Saved report information could not be verified. Refresh to try again.', 'INVALID_RESPONSE', null);
      }
      workbooks.push(...page.items);
    } while (workbooks.length < total);
    return workbooks;
  },

  async upload(cycleId: string, role: WorkbookRole, file: File, signal?: AbortSignal): Promise<WorkbookUpload> {
    const body = new FormData();
    body.append('role', role);
    body.append('file', file);
    // fetch supplies the multipart Content-Type and boundary. The shared client
    // deliberately leaves that header unset for FormData requests.
    const result = await apiClient.request<WorkbookUpload>(`/cycles/${encodeURIComponent(cycleId)}/workbooks`, {
      method: 'POST', body, signal,
    });
    if (result.workbook.cycle_id !== cycleId || result.workbook.role !== role || typeof result.duplicate !== 'boolean') {
      throw new ApiError('The upload response could not be verified. Refresh saved reports before trying again.', 'INVALID_RESPONSE', null);
    }
    return result;
  },
};

// Fixed UI messages avoid displaying any unexpected source-bearing error text.
export function reportError(failure: unknown, phase: 'upload' | 'list' = 'upload'): ApiError {
  const error = failure instanceof ApiError ? failure : new ApiError('', 'UNEXPECTED_ERROR', null);
  let message = 'The request could not be completed. Refresh saved reports before trying again.';
  if (error.status === 409) message = 'This role already contains a different workbook. Existing evidence cannot be replaced. Select the original file to check a duplicate, or use a new cycle for changed content.';
  else if (error.status === 413) message = 'The workbook exceeds a server file-size or expanded-workbook limit. Choose a smaller workbook or ask your administrator to check the configured limits.';
  else if (error.status === 415) message = 'This file type is unsupported. Choose an ordinary .xlsx workbook.';
  else if (error.status === 422) {
    const hints: Record<string, string> = {
      MISSING_WORKSHEETS: 'Required worksheets are missing. Check the expected structure shown on this card.',
      MISSING_COLUMNS: 'Required columns are missing. Check the row-1 headers against the expected structure on this card.',
      UNSUPPORTED_CELL: 'A formula or Excel error cell was found. Supply a values-only .xlsx export.',
      INVALID_HEADERS: 'Check that every populated column has a text header in Excel row 1.',
      AMBIGUOUS_HEADERS: 'Some headers are duplicates after whitespace normalization. Use distinct headers.',
      AMBIGUOUS_LAYOUT: 'Multiple supported worksheet layouts were found. Choose an export containing exactly one accepted layout.',
      INVALID_SEQUENCE: 'The Errors worksheet must contain integers or blank values in S.No.',
      WORKSHEET_LIMIT: 'A worksheet exceeds a configured row or column limit. Ask your administrator to check the report layout.',
      INVALID_FILENAME: 'Use a filename without control characters and no more than 255 characters.',
    };
    message = hints[error.code] ?? 'This is not a supported, readable workbook. Check its structure and export it again as an ordinary .xlsx file.';
  } else if (error.status === 404) message = 'This upload cycle is unavailable. Return to Projects and select a valid cycle.';
  else if (error.code === 'INGESTION_FAILED') message = 'The server could not save this import and rolled it back. Refresh saved reports, then try again.';
  else if (error.code === 'NETWORK_ERROR') message = phase === 'upload'
    ? 'Unable to reach TraceSync. Check that the backend is running. The upload outcome may be unknown; refresh saved reports before retrying.'
    : 'Unable to reach TraceSync. Check that the backend is running, then refresh saved reports to try again.';
  return new ApiError(message, error.code, error.status, error.requestId);
}
