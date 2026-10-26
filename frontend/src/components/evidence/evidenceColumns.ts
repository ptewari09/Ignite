import type { EvidenceField, EvidenceKind, EvidenceRecord } from '../../types/evidence';
import type { WorkbookRole } from '../../types/workbook';

export interface EvidenceColumn { field: EvidenceField; label: string; message?: boolean; manual?: boolean }
interface Dataset {
  kind: EvidenceKind;
  title: string;
  role: WorkbookRole;
  roleLabel: string;
  description: string;
  fields: EvidenceColumn[];
}

export const evidenceDatasets: Dataset[] = [
  { kind: 'transformation-findings', title: 'Transformation Findings', role: 'transformation', roleLabel: 'Transformation Report',
    description: 'Original transformation findings, source status tokens and suggested actions.',
    fields: [
      { field: 'status_raw', label: 'Source status' },
      { field: 'error_category_raw', label: 'Error category' },
      { field: 'error_message_raw', label: 'Message', message: true },
      { field: 'suggested_action_raw', label: 'Source suggested action', message: true },
      { field: 'file_name_raw', label: 'Source File Name field' },
    ] },
  { kind: 'upload-objects', title: 'Upload Objects', role: 'post_upload', roleLabel: 'Post-Upload Report',
    description: 'Tool output and imported manual annotations are shown separately. An annotation does not establish approval.',
    fields: [
      { field: 'status_info_raw', label: 'Status Inf token' },
      { field: 'tool_status_raw', label: 'Tool status' },
      { field: 're_upload_raw', label: 'Re Upload token' },
      { field: 'manual_status_raw', label: 'Imported manual status', manual: true },
      { field: 'manual_comments_raw', label: 'Imported manual comments', message: true, manual: true },
    ] },
  { kind: 'upload-errors', title: 'Upload Errors', role: 'post_upload', roleLabel: 'Post-Upload Report',
    description: 'Detailed technical messages. Some rows have no direct object identity; missing values are preserved.',
    fields: [
      { field: 'info_raw', label: 'Info token' },
      { field: 'sequence_number', label: 'S.No' },
      { field: 'message_type_raw', label: 'Message type' },
      { field: 'message_raw', label: 'Message', message: true },
    ] },
];

export const identityColumns: EvidenceColumn[] = [
  { field: 'object_type_raw', label: 'Object type' }, { field: 'object_name_raw', label: 'Object name' },
];
export const sourceColumns: EvidenceColumn[] = [
  { field: 'worksheet_name', label: 'Worksheet' }, { field: 'excel_row_number', label: 'Excel row' },
];

export function evidenceValue(record: EvidenceRecord, field: EvidenceField): unknown {
  return Reflect.get(record, field);
}

function searchableValues(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return Object.values(value).map(searchableValues).join(' ');
  return String(value);
}

export function matchesCurrentPage(record: EvidenceRecord, query: string): boolean {
  return searchableValues(record).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
