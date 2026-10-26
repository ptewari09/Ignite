import { ApiError, apiClient } from './apiClient';
import type { EvidenceByKind, EvidenceKind } from '../types/evidence';
import type { Page } from '../types/workspace';

export const EVIDENCE_PAGE_SIZE = 25;

export const evidenceApi = {
  async page<Kind extends EvidenceKind>(cycleId: string, kind: Kind, workbookId: string, offset: number, signal?: AbortSignal): Promise<Page<EvidenceByKind[Kind]>> {
    const page = await apiClient.request<Page<EvidenceByKind[Kind]>>(
      `/cycles/${encodeURIComponent(cycleId)}/${kind}?limit=${EVIDENCE_PAGE_SIZE}&offset=${offset}`, { signal },
    );
    if (page.offset !== offset || page.limit !== EVIDENCE_PAGE_SIZE || !Number.isInteger(page.total) || page.total < 0
      || page.items.length > page.limit || page.items.some((record) => record.workbook_id !== workbookId)) {
      throw new ApiError('Evidence could not be verified against the selected source. Refresh to try again.', 'INVALID_RESPONSE', null);
    }
    return page;
  },
};

export function evidenceError(failure: unknown): ApiError {
  const error = failure instanceof ApiError ? failure : new ApiError('', 'UNEXPECTED_ERROR', null);
  let message = 'Evidence could not be retrieved. Please try again.';
  if (error.code === 'NETWORK_ERROR') message = 'Unable to reach TraceSync. Check that the backend is running, then try again.';
  else if (error.status === 404) message = 'This cycle is unavailable. Return to Projects and select a valid cycle.';
  else if (error.code === 'INVALID_RESPONSE') message = 'The response did not match the requested page or source workbook. Refresh to try again.';
  return new ApiError(message, error.code, error.status, error.requestId);
}
