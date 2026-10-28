import type { WorkbookRole } from '../../types/workbook';

// Verified against backend/app/services/importers/{transformation,upload_objects,upload_errors}.py.
export const uploadRequirements: { role: WorkbookRole; title: string; description: string;
  sheets: { name: string; description: string; headers: string[] }[] }[] = [
  { role: 'transformation', title: 'Transformation Report',
    description: 'Findings generated during transformation or remediation, with the original messages and suggested actions.',
    sheets: [{ name: 'Detailed_LOG or Detailed_Log', description: 'Use either exact worksheet name with the same required columns.',
      headers: ['Status', 'Object Type', 'Object Name', 'Error Category', 'Message', 'Suggested Action', 'File Name'] }] },
  { role: 'post_upload', title: 'Post-Upload Report',
    description: 'Object identities and detailed technical messages recorded after an upload attempt, with statuses and annotations when supplied.',
    sheets: [
      { name: 'Objects or Sheet1', description: 'Use Objects with Errors, or Sheet1 with Sheet2. Repeated source rows are preserved.',
        headers: ['Status Inf', 'Object Typ', 'Object Name', 'Status', 'Re Upload', 'Manually added status', 'Manually added comments'] },
      { name: 'Errors or Sheet2', description: 'Detailed technical messages. All six columns are required in either layout; sequence values are preserved.',
        headers: ['Info', 'S.No', 'Object Typ', 'Object Name', 'Type', 'Message'] },
    ] },
];

export function parseUploadLimit(value: string | undefined): { maxBytes: number; error: string | null } {
  // Same default as Settings.max_upload_bytes; no settings endpoint exists.
  const maxBytes = value === undefined || value.trim() === '' ? 20 * 1024 * 1024 : Number(value);
  return Number.isSafeInteger(maxBytes) && maxBytes > 0
    ? { maxBytes, error: null }
    : { maxBytes: 20 * 1024 * 1024, error: 'The frontend upload limit is invalid. Ask your administrator to check the upload configuration.' };
}

export const uploadLimit = parseUploadLimit(import.meta.env.VITE_MAX_UPLOAD_BYTES);

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes.toLocaleString()} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MiB`;
}

export function validateSelection(files: File[], maxBytes: number): string | null {
  if (files.length !== 1) return 'Choose one workbook at a time for this report.';
  if (!/\.xlsx$/i.test(files[0].name)) return 'Choose an .xlsx workbook. Legacy .xls, macro-enabled .xlsm and other file types are unsupported.';
  if (!files[0].size) return 'This file is empty. Choose a readable .xlsx workbook.';
  if (files[0].size > maxBytes) return `This file exceeds the ${formatFileSize(maxBytes)} upload limit. Choose a smaller workbook.`;
  return null;
}
