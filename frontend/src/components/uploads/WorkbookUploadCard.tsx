import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent, SubmitEvent } from 'react';
import { CheckCircle2, FileSpreadsheet, FileUp, X } from 'lucide-react';
import type { ApiError } from '../../services/apiClient';
import { reportError, workbookApi } from '../../services/workbookApi';
import type { Workbook, WorkbookRole, WorkbookUpload } from '../../types/workbook';
import { LoadingState, RequestError } from '../projects/RequestFeedback';
import { ImportDetails } from './ImportDetails';
import { formatFileSize, uploadLimit, uploadRequirements, validateSelection } from './uploadRequirements';

interface Props {
  requirement: typeof uploadRequirements[number];
  cycleId: string | null;
  workbook?: Workbook;
  ready: boolean;
  onImported: (result: WorkbookUpload) => void;
  onBusyChange: (role: WorkbookRole, busy: boolean) => void;
  onConflict: () => void;
}

export function WorkbookUploadCard({ requirement, cycleId, workbook, ready, onImported, onBusyChange, onConflict }: Props) {
  const { role, title, description, sheets } = requirement;
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const chooserRef = useRef<HTMLButtonElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'imported' | 'duplicate' | null>(null);
  const [dragging, setDragging] = useState(false);
  const pending = useRef(false);
  const dragDepth = useRef(0);
  const active = useRef(false);
  const uploadRequest = useRef<AbortController | null>(null);
  const disabled = !ready || !cycleId || busy || !!uploadLimit.error;
  const unconfirmed = error && (error.status === null || error.status >= 500) && error.code !== 'INGESTION_FAILED';

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; uploadRequest.current?.abort(); };
  }, []);

  function selectFiles(files: File[]) {
    if (disabled) return;
    setError(null);
    setResult(null);
    const validation = validateSelection(files, uploadLimit.maxBytes);
    setSelectionError(validation);
    setFile(validation ? null : files[0]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!disabled) selectFiles(Array.from(event.dataTransfer.files));
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || pending.current || !file || !cycleId) return;
    // This closure captures the selected cycle and file before the request.
    // A cycle change remounts the workspace and aborts this browser request.
    const controller = new AbortController();
    uploadRequest.current = controller;
    pending.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    onBusyChange(role, true);
    try {
      const imported = await workbookApi.upload(cycleId, role, file, controller.signal);
      if (!active.current || controller.signal.aborted) return;
      onImported(imported);
      setResult(imported.duplicate ? 'duplicate' : 'imported');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (failure) {
      if (active.current && !controller.signal.aborted) {
        const reported = reportError(failure);
        setError(reported);
        if (reported.status === 409) onConflict();
      }
    } finally {
      if (active.current && !controller.signal.aborted) {
        pending.current = false;
        setBusy(false);
        onBusyChange(role, false);
      }
    }
  }

  return <section className="workspace-panel upload-card" aria-labelledby={`${id}-title`}>
    <div className="upload-card-heading"><span className={`upload-role-icon${role === 'post_upload' ? ' upload-role-secondary' : ''}`}><FileSpreadsheet size={23} aria-hidden="true" /></span>
      <div><span className="panel-eyebrow">{role === 'transformation' ? 'Initial findings' : 'After upload'}</span><h2 id={`${id}-title`}>{title}</h2></div></div>
    <p className="panel-description">{description}</p>
    <details className="workbook-requirements"><summary>Required worksheets and columns</summary>
      <p>Choose one supported worksheet layout with text headers in Excel row 1. Header whitespace is normalized; values-only exports are required. Summary sheets are optional.</p>
      {sheets.map((sheet) => <div key={sheet.name}><h3>{sheet.name}</h3><p>{sheet.description}</p><ul>{sheet.headers.map((header) => <li key={header}>{header}</li>)}</ul></div>)}
      {role === 'post_upload' && <p>Use exactly one pair: Objects + Errors, or Sheet1 + Sheet2. Objects requires all seven listed columns. Sheet1 requires only Status Inf, Object Typ and Object Name; Status, Re Upload and both manual annotation columns are optional. Missing columns remain not supplied. Imported annotations do not imply approval.</p>}
    </details>
    {workbook ? <ImportDetails workbook={workbook} verified={ready} /> : <p className="upload-saved-status">{unconfirmed ? 'Upload outcome is unconfirmed. Refresh saved reports.' : ready ? 'Not uploaded' : cycleId ? 'Saved workbook status unavailable until checked' : 'Select a cycle to upload'}</p>}
    {workbook && <p className="upload-occupied-note">This report is already saved. You can check an identical duplicate below. Use another cycle for a different workbook; saved evidence cannot be replaced.</p>}
    <form aria-label={`Upload ${title}`} className="upload-form" onSubmit={submit} aria-busy={busy}>
      <div className={`file-dropzone${dragging ? ' file-dropzone-active' : ''}${disabled ? ' file-dropzone-disabled' : ''}`} aria-disabled={disabled}
        onDragOver={(event) => event.preventDefault()} onDrop={drop}
        onDragEnter={(event) => { event.preventDefault(); if (!disabled) { dragDepth.current += 1; setDragging(true); } }}
        onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}>
        <FileUp size={25} aria-hidden="true" /><p>Drop one .xlsx workbook here</p><span>or choose a file from your computer</span>
        <label className="sr-only" htmlFor={`${id}-file`}>{title} workbook</label>
        <input ref={inputRef} className="sr-only" tabIndex={-1} id={`${id}-file`} type="file" accept=".xlsx" disabled={disabled}
          aria-describedby={`${id}-file-hint${selectionError ? ` ${id}-file-error` : ''}`} aria-invalid={!!selectionError}
          onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) selectFiles(files); }} />
        <button ref={chooserRef} className="secondary-button" type="button" disabled={disabled} aria-label={`${file ? 'Change' : 'Choose'} file for ${title}`}
          onClick={() => inputRef.current?.click()}>{file ? 'Change file' : 'Choose file'}</button>
      </div>
      <p id={`${id}-file-hint`} className="field-hint">.xlsx only · Maximum {formatFileSize(uploadLimit.maxBytes)} per file. Workbook structure is validated by the server.</p>
      {selectionError && <p id={`${id}-file-error`} className="field-error" role="alert">{selectionError}</p>}
      {file && <div className="selected-file" role="status"><FileSpreadsheet size={18} aria-hidden="true" /><div><strong>{file.name}</strong><span>{formatFileSize(file.size)}</span></div>
        <button className="icon-button" type="button" disabled={busy} aria-label={`Clear file for ${title}`} onClick={() => { setFile(null); setSelectionError(null); setError(null); chooserRef.current?.focus(); }}><X size={16} aria-hidden="true" /></button>
      </div>}
      <button className="primary-button upload-submit" type="submit" disabled={disabled || !file}
        aria-label={`${workbook ? 'Check duplicate' : 'Upload'} ${title}`}>{busy ? 'Uploading and validating…' : workbook ? 'Check duplicate' : 'Upload report'}</button>
      {busy && <LoadingState>Uploading and validating… Please keep this workspace open.</LoadingState>}
    </form>
    {result && <p className={`upload-result${result === 'duplicate' ? ' upload-duplicate' : ''}`} role="status"><CheckCircle2 size={17} aria-hidden="true" /><span>{result === 'duplicate' ? 'Duplicate re-upload: this workbook was already imported. Existing records were reused; no records were added.' : 'Import successful. Saved record counts and warnings are shown above.'}</span></p>}
    {error && <RequestError title={`Last attempt: ${unconfirmed ? 'Upload not confirmed' : 'Upload failed'}`} error={error} />}
  </section>;
}
