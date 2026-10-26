// Read-only response fields from backend/app/schemas/ingestion.py.
export interface EvidenceBase {
  id: string;
  workbook_id: string;
  worksheet_name: string;
  excel_row_number: number;
  object_type_raw: string | null;
  object_name_raw: string | null;
  object_type_normalized: string | null;
  object_name_normalized: string | null;
  raw_payload: Record<string, unknown>;
}

export interface TransformationFinding extends EvidenceBase {
  status_raw: string | null;
  error_category_raw: string | null;
  error_message_raw: string | null;
  suggested_action_raw: string | null;
  file_name_raw: string | null;
}

export interface UploadObject extends EvidenceBase {
  status_info_raw: string | null;
  tool_status_raw: string | null;
  re_upload_raw: string | null;
  manual_status_raw: string | null;
  manual_comments_raw: string | null;
}

export interface UploadError extends EvidenceBase {
  info_raw: string | null;
  sequence_number: number | null;
  message_type_raw: string | null;
  message_raw: string | null;
}

export interface EvidenceByKind {
  'transformation-findings': TransformationFinding;
  'upload-objects': UploadObject;
  'upload-errors': UploadError;
}

export type EvidenceKind = keyof EvidenceByKind;
export type EvidenceRecord = EvidenceByKind[EvidenceKind];
export type EvidenceField = keyof TransformationFinding | keyof UploadObject | keyof UploadError;
