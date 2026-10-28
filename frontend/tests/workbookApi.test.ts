import { describe, expect, it, vi } from 'vitest';
import { reportError, workbookApi } from '../src/services/workbookApi';
import { ApiError } from '../src/services/apiClient';
import { parseUploadLimit, validateSelection } from '../src/components/uploads/uploadRequirements';
import { cycleA, jsonResponse } from './fixtures/workspace';
import { workbookFile, workbookFixture } from './fixtures/workbooks';

describe('Workbook API and file constraints', () => {
  it('explains ambiguous layouts without exposing server source text or losing the request ID', () => {
    const error = reportError(new ApiError('private source details', 'AMBIGUOUS_LAYOUT', 422, 'layout-request'));
    expect(error.message).toContain('exactly one accepted layout');
    expect(error.message).not.toContain('private');
    expect(error.requestId).toBe('layout-request');
    expect(error.code).toBe('AMBIGUOUS_LAYOUT');
  });

  it('follows the real pagination envelope for saved workbook metadata', async () => {
    const a = workbookFixture();
    const b = workbookFixture('post_upload');
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ items: [a], total: 2, limit: 1, offset: 0 }))
      .mockResolvedValueOnce(jsonResponse({ items: [b], total: 2, limit: 1, offset: 1 }));
    vi.stubGlobal('fetch', fetch);
    expect(await workbookApi.list(cycleA.id)).toEqual([a, b]);
    expect(fetch.mock.calls[1][0]).toContain('limit=200&offset=1');
  });

  it('rejects metadata and upload responses belonging to a different cycle', async () => {
    const other = workbookFixture('transformation', 'other-cycle');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ items: [other], total: 1, limit: 200, offset: 0 }))
      .mockResolvedValueOnce(jsonResponse({ workbook: other, duplicate: false })));
    await expect(workbookApi.list(cycleA.id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(workbookApi.upload(cycleA.id, 'transformation', workbookFile())).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('uses the backend default and accepts an explicit positive file limit', () => {
    expect(parseUploadLimit(undefined)).toEqual({ maxBytes: 20971520, error: null });
    expect(parseUploadLimit('1024')).toEqual({ maxBytes: 1024, error: null });
    for (const value of ['0', '-1', 'invalid', '1.5', 'Infinity']) expect(parseUploadLimit(value).error).toBeTruthy();
  });

  it('allows files exactly at the configured limit and rejects larger ones without reading them', () => {
    const file = workbookFile('synthetic.XLSX');
    expect(validateSelection([file], file.size)).toBeNull();
    expect(validateSelection([file], file.size - 1)).toContain('exceeds');
  });
});
