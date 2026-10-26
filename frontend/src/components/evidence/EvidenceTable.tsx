import type { EvidenceKind, EvidenceRecord } from '../../types/evidence';
import { evidenceDatasets, evidenceValue, identityColumns, sourceColumns } from './evidenceColumns';
import { EvidenceValue } from './EvidenceValue';

export function EvidenceTable({ kind, records, onInspect }: { kind: EvidenceKind; records: EvidenceRecord[]; onInspect: (record: EvidenceRecord) => void }) {
  const dataset = evidenceDatasets.find((item) => item.kind === kind)!;
  const columns = [...identityColumns, ...dataset.fields, ...sourceColumns];
  return <div className="evidence-table-scroll" role="region" aria-label={`${dataset.title} table, scroll horizontally for all columns`} tabIndex={0}>
    <table className="evidence-table"><caption className="sr-only">{dataset.title}: each row is an independent source record.</caption>
      <thead><tr><th scope="col">Details</th>{columns.map((column) => <th key={column.field} scope="col" className={column.manual ? 'evidence-manual-column' : undefined}>{column.label}</th>)}</tr></thead>
      <tbody>{records.map((record) => <tr key={record.id}>
        <td><button className="secondary-button evidence-inspect" type="button" aria-label={`Inspect ${record.worksheet_name} row ${record.excel_row_number}`} onClick={() => onInspect(record)}>Inspect</button></td>
        {columns.map((column) => <td key={column.field} className={`${column.message ? 'evidence-message-cell' : 'evidence-source-cell'}${column.manual ? ' evidence-manual-column' : ''}`}><EvidenceValue value={evidenceValue(record, column.field)} /></td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}
