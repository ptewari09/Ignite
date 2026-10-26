import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, FolderOpen, RefreshCw, Search } from 'lucide-react';
import { Link } from 'react-router';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { ApiError } from '../services/apiClient';
import { evidenceApi, evidenceError, EVIDENCE_PAGE_SIZE } from '../services/evidenceApi';
import { workbookApi } from '../services/workbookApi';
import type { EvidenceKind, EvidenceRecord } from '../types/evidence';
import type { Workbook } from '../types/workbook';
import type { Page } from '../types/workspace';
import { LoadingState, RequestError } from '../components/projects/RequestFeedback';
import { evidenceDatasets, matchesCurrentPage } from '../components/evidence/evidenceColumns';
import { EvidenceTable } from '../components/evidence/EvidenceTable';
import { EvidenceDetail } from '../components/evidence/EvidenceDetail';

function EvidenceDataset({ kind, cycleId, workbook }: { kind: EvidenceKind; cycleId: string; workbook: Workbook }) {
  const dataset = evidenceDatasets.find((item) => item.kind === kind)!;
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState<Page<EvidenceRecord> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<EvidenceRecord | null>(null);
  const filterId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterLoad = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    evidenceApi.page(cycleId, kind, workbook.id, offset, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setPage(result);
        if (focusAfterLoad.current) { heading.current?.focus(); focusAfterLoad.current = false; }
      }
    }).catch((failure: unknown) => { if (!controller.signal.aborted) setError(evidenceError(failure)); });
    return () => controller.abort();
  }, [cycleId, kind, workbook.id, offset, revision]);

  function changePage(nextOffset: number) {
    focusAfterLoad.current = true;
    setSelected(null); setPage(null); setError(null); setQuery(''); setOffset(nextOffset);
  }

  function refresh() {
    setSelected(null); setPage(null); setError(null); setQuery(''); setRevision((value) => value + 1);
  }

  const visible = page?.items.filter((record) => matchesCurrentPage(record, query)) ?? [];
  const busy = !page && !error;
  return <>
    <div className="evidence-dataset-heading"><div><h2 ref={heading} tabIndex={-1}>{dataset.title}</h2><p>{dataset.description}</p></div>
      <button className="secondary-button" type="button" disabled={busy} onClick={refresh}><RefreshCw size={14} aria-hidden="true" />Refresh page</button></div>
    <p className="evidence-source-note">Source: <strong>{workbook.original_filename}</strong> · {dataset.roleLabel}</p>
    <div className="evidence-filter"><label htmlFor={filterId}>Filter current page</label><div><Search size={16} aria-hidden="true" /><input id={filterId} type="search" value={query} disabled={!page || !page.total}
      onChange={(event) => { setQuery(event.target.value); setSelected(null); }} aria-describedby={`${filterId}-scope`} placeholder="Find an object, status or source text" />
      {query && <button className="secondary-button" type="button" onClick={() => setQuery('')}>Clear filter</button>}</div>
      <p id={`${filterId}-scope`}>Searches values in the loaded page only. Server totals include all records. The filter clears when changing pages or tabs.</p></div>
    {busy && <LoadingState>{`Loading ${dataset.title.toLocaleLowerCase()}…`}</LoadingState>}
    {error && <RequestError title="Could not load evidence" error={error} onRetry={refresh} />}
    {page && <>
      <p className="evidence-page-summary" role="status" aria-live="polite">{page.total ? `Records ${page.offset + 1}–${page.offset + page.items.length} of ${page.total}` : '0 records'}{query.trim() ? ` · ${visible.length} of ${page.items.length} loaded records match this page filter` : ''}</p>
      {!page.total ? <div className="evidence-empty"><h3>No records in this dataset</h3><p>The source workbook is imported, but this dataset contains no records.</p></div>
        : !visible.length ? <div className="evidence-empty"><h3>No matches on this page</h3><p>Clear the current-page filter or browse another page. This does not mean the whole dataset has no matches.</p></div>
          : <><p className="evidence-scroll-hint">Scroll horizontally for all source fields. Inspect a row for complete raw values and normalized identity.</p><EvidenceTable kind={kind} records={visible} onInspect={setSelected} /></>}
      <nav className="evidence-pagination" aria-label="Evidence pages"><button className="secondary-button" type="button" disabled={!page.offset} onClick={() => changePage(Math.max(0, page.offset - EVIDENCE_PAGE_SIZE))}><ArrowLeft size={14} aria-hidden="true" />Previous</button>
        <span>{EVIDENCE_PAGE_SIZE} records per page</span><button className="secondary-button" type="button" disabled={page.offset + page.limit >= page.total} onClick={() => changePage(page.offset + page.limit)}>Next<ArrowRight size={14} aria-hidden="true" /></button></nav>
    </>}
    {selected && <EvidenceDetail record={selected} workbook={workbook} kind={kind} onClose={() => setSelected(null)} />}
  </>;
}

function EvidenceWorkspace({ cycleId }: { cycleId: string }) {
  const id = useId();
  const [kind, setKind] = useState<EvidenceKind>('transformation-findings');
  const [workbooks, setWorkbooks] = useState<Workbook[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const read = useRef<AbortController | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabList = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function revealActiveTab() {
      const strip = tabList.current;
      const button = tabRefs.current[evidenceDatasets.findIndex((item) => item.kind === kind)];
      if (!strip || !button || !strip.clientWidth) return;
      const bounds = strip.getBoundingClientRect();
      const active = button.getBoundingClientRect();
      // Leave room for focus outlines and round outward to avoid fractional
      // pixel clipping when the desktop layout becomes a narrow tab strip.
      if (active.left < bounds.left + 4) strip.scrollLeft -= Math.ceil(bounds.left + 4 - active.left);
      else if (active.right > bounds.right - 4) strip.scrollLeft += Math.ceil(active.right - bounds.right + 4);
    }
    revealActiveTab();
    window.addEventListener('resize', revealActiveTab);
    return () => window.removeEventListener('resize', revealActiveTab);
  }, [kind]);

  const loadWorkbooks = useCallback(() => {
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    return workbookApi.list(cycleId, controller.signal).then((result) => {
      if (!controller.signal.aborted) setWorkbooks(result);
    }).catch((failure: unknown) => { if (!controller.signal.aborted) setError(evidenceError(failure)); });
  }, [cycleId]);
  useEffect(() => { void loadWorkbooks(); return () => read.current?.abort(); }, [loadWorkbooks]);

  function refreshWorkbooks() { setWorkbooks(null); setError(null); void loadWorkbooks(); }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % evidenceDatasets.length;
    else if (event.key === 'ArrowLeft') next = (index + evidenceDatasets.length - 1) % evidenceDatasets.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = evidenceDatasets.length - 1;
    else return;
    event.preventDefault();
    setKind(evidenceDatasets[next].kind);
    tabRefs.current[next]?.focus({ preventScroll: true });
  }
  const dataset = evidenceDatasets.find((item) => item.kind === kind)!;
  const workbook = workbooks?.find((item) => item.role === dataset.role);
  return <section className="evidence-workspace" aria-label="Evidence datasets">
    <div className="evidence-workspace-toolbar"><span className="evidence-readonly">Read-only source evidence</span><button className="secondary-button" type="button" disabled={!workbooks && !error} onClick={refreshWorkbooks}><RefreshCw size={14} aria-hidden="true" />Refresh sources</button></div>
    <div ref={tabList} className="evidence-tabs" role="tablist" aria-label="Evidence type">{evidenceDatasets.map((item, index) => <button ref={(element) => { tabRefs.current[index] = element; }} key={item.kind} type="button" role="tab"
      id={`${id}-tab-${item.kind}`} aria-controls={`${id}-panel-${item.kind}`} aria-selected={kind === item.kind} tabIndex={kind === item.kind ? 0 : -1}
      className={kind === item.kind ? 'evidence-tab evidence-tab-active' : 'evidence-tab'} onClick={() => setKind(item.kind)} onKeyDown={(event) => tabKey(event, index)}>{item.title}</button>)}</div>
    {evidenceDatasets.map((panel) => <div key={panel.kind} className="evidence-tabpanel" role="tabpanel" hidden={kind !== panel.kind} id={`${id}-panel-${panel.kind}`} aria-labelledby={`${id}-tab-${panel.kind}`} tabIndex={kind === panel.kind ? 0 : -1}>
      {kind === panel.kind && <>
      {!workbooks && !error && <LoadingState>Checking imported workbooks…</LoadingState>}
      {error && <RequestError title="Could not check source workbooks" error={error} onRetry={refreshWorkbooks} />}
      {workbooks && (workbook ? <EvidenceDataset key={kind} kind={kind} cycleId={cycleId} workbook={workbook} />
        : <div className="evidence-empty"><h2>{dataset.roleLabel} not imported</h2><p>{dataset.role === 'transformation' ? 'Upload a transformation workbook with Detailed_LOG to inspect transformation findings.' : 'Upload a post-upload workbook with Objects and Errors to inspect its object results and technical messages.'}</p><Link className="primary-button" to="/upload-reports">Go to Upload Reports</Link></div>)}
      </>}
    </div>)}
  </section>;
}

export function EvidenceExplorerPage() {
  const { selectedProject, selectedCycle } = useWorkspace();
  const cycle = selectedProject && selectedCycle?.project_id === selectedProject.id ? selectedCycle : null;
  return <div className="page-content evidence-page"><section className="overview-introduction" aria-labelledby="evidence-heading"><h1 id="evidence-heading">Evidence Explorer</h1><p>Browse original findings, object results and technical messages with their workbook, worksheet and Excel-row provenance.</p></section>
    <div className="upload-workspace-context"><FolderOpen size={21} aria-hidden="true" /><dl><div><dt>Project</dt><dd>{selectedProject?.name ?? 'No project selected'}</dd></div><div><dt>Upload cycle</dt><dd>{cycle?.name ?? 'No cycle selected'}</dd></div></dl><Link className="secondary-button" to="/projects">Manage workspace</Link></div>
    {cycle ? <EvidenceWorkspace key={cycle.id} cycleId={cycle.id} />
      : <section className="upload-empty" aria-labelledby="evidence-empty-heading"><h2 id="evidence-empty-heading">Choose a project and upload cycle</h2><p>Open Projects to create or select a project and its upload cycle, then return here to inspect imported evidence.</p><Link className="primary-button" to="/projects">Go to Projects</Link></section>}
  </div>;
}
