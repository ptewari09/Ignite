import { describe, expect, it, vi } from 'vitest';
import { evidenceApi } from '../src/services/evidenceApi';
import { cycleA, jsonResponse } from './fixtures/workspace';
import { workbookFixture } from './fixtures/workbooks';
import { evidenceRows } from './fixtures/evidence';

describe('Evidence pagination contract', () => {
  it('requests one bounded server page with no unsupported search parameters', async () => {
    const rows = evidenceRows()['transformation-findings'];
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ items: rows.slice(25), total: rows.length, limit: 25, offset: 25 }));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    const result = await evidenceApi.page(cycleA.id, 'transformation-findings', workbookFixture().id, 25, controller.signal);
    expect(result.items).toHaveLength(6);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(`http://127.0.0.1:8000/api/v1/cycles/${cycleA.id}/transformation-findings?limit=25&offset=25`);
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('rejects a response from the wrong page or workbook instead of assigning false provenance', async () => {
    const rows = evidenceRows()['upload-errors'];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ items: rows, total: 4, offset: 25, limit: 25 }))
      .mockResolvedValueOnce(jsonResponse({ items: rows, total: 4, offset: 0, limit: 25 })));
    await expect(evidenceApi.page(cycleA.id, 'upload-errors', workbookFixture('post_upload').id, 0)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(evidenceApi.page(cycleA.id, 'upload-errors', 'different-workbook', 0)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
