import type { EvidenceByKind, EvidenceKind, TransformationFinding, UploadError, UploadObject } from '../../src/types/evidence';
import { cycleA, jsonResponse } from './workspace';
import { uploadFixture, workbookFixture } from './workbooks';

export function evidenceRows(cycleId = cycleA.id, total = 31): { [Kind in EvidenceKind]: EvidenceByKind[Kind][] } {
  const a = workbookFixture('transformation', cycleId);
  const b = workbookFixture('post_upload', cycleId);
  const findings: TransformationFinding[] = Array.from({ length: total }, (_, index) => ({
    id: `finding-${cycleId}-${index}`, workbook_id: a.id, worksheet_name: 'Detailed_LOG', excel_row_number: index + 2,
    object_type_raw: index === 2 ? null : ' prog  ', object_type_normalized: index === 2 ? null : 'PROG',
    object_name_raw: index === 2 ? null : index < 2 ? ' z_synthetic_order ' : `Z_SYNTH_${String(index).padStart(3, '0')}`,
    object_name_normalized: index === 2 ? null : index < 2 ? 'Z_SYNTHETIC_ORDER' : `Z_SYNTH_${String(index).padStart(3, '0')}`,
    status_raw: '@0A@', error_category_raw: index === 1 ? 'NO_TLAYER' : 'OBJ_LOCKED',
    error_message_raw: `Fictional finding message ${index}.\nSecond source line.`, suggested_action_raw: null, file_name_raw: null,
    raw_payload: { 'Object Type': index === 2 ? null : ' prog  ', 'Object Name': index === 2 ? null : index < 2 ? ' z_synthetic_order ' : `Z_SYNTH_${String(index).padStart(3, '0')}`, 'Extra count': 0 },
  }));
  const objects: UploadObject[] = [0, 1].map((index) => ({
    id: `object-${cycleId}-${index}`, workbook_id: b.id, worksheet_name: 'Objects', excel_row_number: index + 2,
    object_type_raw: 'PROG  ', object_type_normalized: 'PROG', object_name_raw: 'Z_SYNTHETIC_ORDER', object_name_normalized: 'Z_SYNTHETIC_ORDER',
    status_info_raw: 'DEMO ', tool_status_raw: 'UPLD_ERROR', re_upload_raw: '@4R@',
    manual_status_raw: index ? 'Needs review' : 'Uploaded', manual_comments_raw: `Fictional manual note ${index}.`,
    raw_payload: { 'Status    ': 'UPLD_ERROR', 'Manually added status': index ? 'Needs review' : 'Uploaded' },
  }));
  const errors: UploadError[] = [0, 1, 2, 3].map((index) => ({
    id: `error-${cycleId}-${index}`, workbook_id: b.id, worksheet_name: 'Errors', excel_row_number: index + 2,
    object_type_raw: index === 1 ? '    ' : 'PROG ', object_type_normalized: index === 1 ? null : 'PROG',
    object_name_raw: index === 1 ? null : 'Z_SYNTHETIC_ORDER', object_name_normalized: index === 1 ? null : 'Z_SYNTHETIC_ORDER',
    info_raw: 'DEMO', sequence_number: index, message_type_raw: index === 1 ? 'I   ' : 'W ',
    message_raw: index === 1 ? 'Fictional component context.' : `Fictional upload message ${index}.`,
    raw_payload: { 'Object Typ': index === 1 ? '    ' : 'PROG ', 'Object Name': index === 1 ? null : 'Z_SYNTHETIC_ORDER', 'S.No': index },
  }));
  return { 'transformation-findings': findings, 'upload-objects': objects, 'upload-errors': errors };
}

export function evidenceFixture(hasTransformation = true, hasPostUpload = true) {
  const base = uploadFixture([...(hasTransformation ? [workbookFixture()] : []), ...(hasPostUpload ? [workbookFixture('post_upload')] : [])]);
  const uploadFetch = base.fetch.getMockImplementation()!;
  const records = new Map([[cycleA.id, evidenceRows()]]);
  const requests: { cycleId: string; kind: EvidenceKind; offset: number; limit: number; signal: AbortSignal | null | undefined }[] = [];
  const behavior: { page?: (kind: EvidenceKind, offset: number, cycleId: string) => Promise<Response> } = {};
  base.fetch.mockImplementation(async (input: string, options?: RequestInit) => {
    const url = new URL(input);
    const match = url.pathname.match(/\/cycles\/([^/]+)\/(transformation-findings|upload-objects|upload-errors)$/);
    if (!match) return uploadFetch(input, options);
    const [, cycleId, key] = match;
    const kind = key as EvidenceKind;
    const limit = Number(url.searchParams.get('limit'));
    const offset = Number(url.searchParams.get('offset'));
    requests.push({ cycleId, kind, offset, limit, signal: options?.signal });
    if (behavior.page) return behavior.page(kind, offset, cycleId);
    const rows = records.get(cycleId)?.[kind] ?? [];
    return jsonResponse({ items: rows.slice(offset, offset + limit), total: rows.length, limit, offset });
  });
  return { ...base, records, requests, pageBehavior: behavior };
}
