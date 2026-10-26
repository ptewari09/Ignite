import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import type { EvidenceKind, EvidenceRecord } from '../../types/evidence';
import type { Workbook } from '../../types/workbook';
import { evidenceDatasets, evidenceValue, identityColumns } from './evidenceColumns';
import { EvidenceValue } from './EvidenceValue';

export function EvidenceDetail({ record, workbook, kind, onClose }: { record: EvidenceRecord; workbook: Workbook; kind: EvidenceKind; onClose: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dataset = evidenceDatasets.find((item) => item.kind === kind)!;

  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!element.open) element.showModal();
    closeButton.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
      else document.getElementById('main-content')?.focus();
    };
  }, []);

  function keepFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, summary, [tabindex="0"]'))
      .filter((element) => element.tagName === 'SUMMARY' || !element.closest('details:not([open])'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  const rawFields = [...identityColumns, ...dataset.fields.filter((column) => !column.manual)];
  const manualFields = dataset.fields.filter((column) => column.manual);
  return <dialog ref={dialog} className="evidence-detail-dialog" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-source`}
    onKeyDown={keepFocus} onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="evidence-detail-header"><div><span className="panel-eyebrow">Read-only evidence</span><h2 id={`${id}-heading`}>Evidence record details</h2><p id={`${id}-source`}>{dataset.title} · {record.worksheet_name} · Excel row {record.excel_row_number}</p></div>
      <button ref={closeButton} className="icon-button" type="button" aria-label="Close record details" onClick={onClose}><X size={19} aria-hidden="true" /></button></header>
    <div className="evidence-detail-body" role="region" aria-label="Record details" tabIndex={0}>
      <section className="evidence-detail-section" aria-labelledby={`${id}-provenance`}><h3 id={`${id}-provenance`}>Source provenance</h3><dl className="evidence-fields">
        <div><dt>Source workbook</dt><dd><EvidenceValue value={workbook.original_filename} /></dd></div>
        <div><dt>Workbook role</dt><dd>{dataset.roleLabel} <span className="text-muted">({workbook.role})</span></dd></div>
        <div><dt>Worksheet</dt><dd>{record.worksheet_name}</dd></div><div><dt>Excel row</dt><dd>{record.excel_row_number}</dd></div>
        <div><dt>Record ID</dt><dd><EvidenceValue value={record.id} /></dd></div><div><dt>Workbook ID</dt><dd><EvidenceValue value={record.workbook_id} /></dd></div>
      </dl></section>
      <section className="evidence-detail-section" aria-labelledby={`${id}-raw`}><h3 id={`${id}-raw`}>Original source values</h3><p>Text is quoted so padding, empty strings and escaped characters remain visible. A dash means the value was not provided.</p>
        <dl className="evidence-fields">{rawFields.map((column) => <div key={column.field}><dt>{column.label}</dt><dd><EvidenceValue value={evidenceValue(record, column.field)} quoted /></dd></div>)}</dl>
      </section>
      {!!manualFields.length && <section className="evidence-detail-section evidence-manual-section" aria-labelledby={`${id}-manual`}><h3 id={`${id}-manual`}>Imported manual annotations</h3><p>Separate from tool output. These source annotations do not establish approval.</p>
        <dl className="evidence-fields">{manualFields.map((column) => <div key={column.field}><dt>{column.label}</dt><dd><EvidenceValue value={evidenceValue(record, column.field)} quoted /></dd></div>)}</dl>
      </section>}
      <section className="evidence-detail-section" aria-labelledby={`${id}-normalized`}><h3 id={`${id}-normalized`}>Normalized identity</h3><p>Comparison values supplied by the importer. They do not establish that records match.</p><dl className="evidence-fields">
        <div><dt>Normalized object type</dt><dd><EvidenceValue value={record.object_type_normalized} /></dd></div>
        <div><dt>Normalized object name</dt><dd><EvidenceValue value={record.object_name_normalized} /></dd></div>
      </dl></section>
      <details className="evidence-raw-payload"><summary>Original row payload — all source columns</summary><pre tabIndex={0} aria-label="Original row payload">{JSON.stringify(record.raw_payload, null, 2)}</pre></details>
    </div>
  </dialog>;
}
