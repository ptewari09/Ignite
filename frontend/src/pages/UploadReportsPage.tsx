import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { ApiError } from '../services/apiClient';
import { reportError, workbookApi } from '../services/workbookApi';
import type { Workbook, WorkbookRole, WorkbookUpload } from '../types/workbook';
import { LoadingState, RequestError } from '../components/projects/RequestFeedback';
import { WorkbookUploadCard } from '../components/uploads/WorkbookUploadCard';
import { uploadLimit, uploadRequirements } from '../components/uploads/uploadRequirements';

function UploadWorkspace({ cycleId }: { cycleId: string }) {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<ApiError | null>(null);
  const [busyRoles, setBusyRoles] = useState<WorkbookRole[]>([]);
  const read = useRef<AbortController | null>(null);

  const loadSaved = useCallback(() => {
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    return workbookApi.list(cycleId, controller.signal).then((saved) => {
      if (!controller.signal.aborted) { setWorkbooks(saved); setStatus('ready'); }
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) { setError(reportError(failure, 'list')); setStatus('error'); }
    });
  }, [cycleId]);

  useEffect(() => { void loadSaved(); return () => read.current?.abort(); }, [loadSaved]);

  const refresh = useCallback(() => {
    setStatus('loading');
    setError(null);
    return loadSaved();
  }, [loadSaved]);

  const onImported = useCallback((result: WorkbookUpload) => {
    read.current?.abort();
    setWorkbooks((saved) => [...saved.filter((item) => item.role !== result.workbook.role), result.workbook]);
    setStatus('ready');
    setError(null);
  }, []);
  const onBusyChange = useCallback((role: WorkbookRole, busy: boolean) => {
    setBusyRoles((roles) => busy ? [...new Set([...roles, role])] : roles.filter((item) => item !== role));
  }, []);

  return <>
    <div className="upload-workspace-toolbar"><p>One workbook per role, per cycle.</p><button className="secondary-button" type="button" disabled={status === 'loading' || !!busyRoles.length}
      onClick={() => void refresh()}><RefreshCw size={14} aria-hidden="true" />Refresh saved reports</button></div>
    {status === 'loading' && <LoadingState>Checking saved reports…</LoadingState>}
    {error && <RequestError title="Could not check saved reports" error={error} onRetry={() => void refresh()} />}
    <div className="upload-cards">{uploadRequirements.map((requirement) => <WorkbookUploadCard key={requirement.role} requirement={requirement} cycleId={cycleId}
      workbook={workbooks.find((workbook) => workbook.role === requirement.role)} ready={status === 'ready'} onImported={onImported} onBusyChange={onBusyChange} onConflict={() => void refresh()} />)}</div>
  </>;
}

export function UploadReportsPage() {
  const { selectedProject, selectedCycle } = useWorkspace();
  const validCycle = selectedProject && selectedCycle?.project_id === selectedProject.id ? selectedCycle : null;
  return <div className="page-content upload-page">
    <section className="overview-introduction" aria-labelledby="upload-heading"><h1 id="upload-heading">Upload Reports</h1><p>Import the two source workbooks for your selected upload cycle. Review the saved counts and import warnings before continuing.</p></section>
    <div className="upload-workspace-context"><FolderOpen size={21} aria-hidden="true" /><dl><div><dt>Project</dt><dd>{selectedProject?.name ?? 'No project selected'}</dd></div><div><dt>Upload cycle</dt><dd>{validCycle?.name ?? 'No cycle selected'}</dd></div></dl>
      <Link className="secondary-button" to="/projects">Manage workspace</Link></div>
    {uploadLimit.error && <p className="request-error" role="alert">{uploadLimit.error}</p>}
    {!validCycle ? <>
      <section className="upload-empty" aria-labelledby="upload-empty-heading"><h2 id="upload-empty-heading">Choose a project and upload cycle</h2><p>Open Projects to create or select a project, then select its upload cycle. Uploads will become available for that workspace.</p><Link className="primary-button" to="/projects">Go to Projects</Link></section>
      <div className="upload-cards">{uploadRequirements.map((requirement) => <WorkbookUploadCard key={requirement.role} requirement={requirement} cycleId={null} ready={false} onImported={() => {}} onBusyChange={() => {}} onConflict={() => {}} />)}</div>
    </> : <UploadWorkspace key={validCycle.id} cycleId={validCycle.id} />}
    <p className="upload-data-note"><ShieldCheck size={17} aria-hidden="true" /><span>Only the two source reports belong here. The customer-facing reference report is not an upload input. Original files are not modified. Selected files stay in memory until cleared, imported or you leave this workspace.</span></p>
    <p className="upload-navigation-note">If you leave or change cycles during an upload, its browser request is canceled. The server may already have saved it; return to the original cycle and refresh saved reports to check.</p>
  </div>;
}
