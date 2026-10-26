import { CheckCircle2, TriangleAlert } from 'lucide-react';
import type { Workbook } from '../../types/workbook';
import { formatFileSize } from './uploadRequirements';

export function ImportDetails({ workbook, verified }: { workbook: Workbook; verified: boolean }) {
  return <section className="import-details" aria-label="Saved import details">
    <div className="import-saved-label"><CheckCircle2 size={16} aria-hidden="true" />{verified ? 'Uploaded successfully' : 'Last confirmed import'}</div>
    <dl className="import-metadata">
      <div><dt>Original filename</dt><dd>{workbook.original_filename}</dd></div>
      <div><dt>Imported</dt><dd><time dateTime={workbook.uploaded_at}>{new Date(workbook.uploaded_at).toLocaleString()}</time></dd></div>
      <div><dt>File size</dt><dd>{formatFileSize(workbook.byte_size)}</dd></div>
      <div><dt>Server import status</dt><dd>{workbook.ingestion_status}</dd></div>
    </dl>
    <div className="import-counts" aria-label="Imported record counts">
      {Object.entries(workbook.row_counts).map(([sheet, count]) => <div key={sheet}>
        <h4>{sheet}</h4><p><strong>{count.toLocaleString()}</strong> imported records</p>
        {workbook.object_counts[sheet] !== undefined && <p>{workbook.object_counts[sheet].toLocaleString()} distinct normalized names</p>}
      </div>)}
    </div>
    {!!workbook.warnings.length && <details className="import-warnings"><summary><TriangleAlert size={15} aria-hidden="true" />Import warnings ({workbook.warnings.length})</summary>
      <ul>{workbook.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}><p>{warning.message}</p><span>{warning.worksheet_name ? `${warning.worksheet_name} · ` : ''}Occurrences: {warning.count}</span></li>)}</ul>
    </details>}
  </section>;
}
