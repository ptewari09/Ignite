// Response fields from backend/app/schemas/ingestion.py and importers/types.py.
export type WorkbookRole = 'transformation' | 'post_upload';

export interface ImportWarning {
  code: string;
  message: string;
  worksheet_name: string | null;
  count: number;
}

export interface Workbook {
  id: string;
  cycle_id: string;
  role: WorkbookRole;
  original_filename: string;
  sha256: string;
  byte_size: number;
  uploaded_at: string;
  ingestion_status: string;
  sheets_found: string[];
  row_counts: Record<string, number>;
  object_counts: Record<string, number>;
  warnings: ImportWarning[];
}

export interface WorkbookUpload {
  workbook: Workbook;
  duplicate: boolean;
}
