import { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, FolderKanban, FolderOpen, Layers3, Plus, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { CreationForm } from '../components/projects/CreationForm';
import { LoadingState, RequestError } from '../components/projects/RequestFeedback';
import type { Project } from '../types/workspace';

function createdDate(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(timestamp));
}

function useCreationPanel() {
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (showForm) wasOpen.current = true;
    else if (!creating && wasOpen.current) {
      buttonRef.current?.focus();
      wasOpen.current = false;
    }
  }, [showForm, creating]);
  return { showForm, setShowForm, creating, setCreating, buttonRef };
}

function CyclesPanel({ project, announce }: { project: Project; announce: (message: string) => void }) {
  const { cycles, cycleStatus, cycleError, selectedCycleId, projectStatus,
    refreshCycles, selectCycle, createCycle } = useWorkspace();
  const { showForm, setShowForm, creating, setCreating, buttonRef } = useCreationPanel();

  useEffect(() => { void refreshCycles(project.id); }, [project.id, refreshCycles]);

  return <section className="workspace-panel cycles-panel" aria-labelledby="cycles-heading">
    <div className="panel-heading">
      <div className="panel-heading-copy"><span className="panel-eyebrow">Selected project</span><h2 id="cycles-heading">{project.name}</h2><p>Upload cycles</p></div>
      <Layers3 size={22} className="panel-heading-icon" aria-hidden="true" />
    </div>
    <p className="panel-description">A cycle keeps one run’s reports and evidence together. Select a cycle to make it your active workspace.</p>
    <div className="panel-toolbar">
      <button className="secondary-button" type="button" disabled={cycleStatus === 'loading' || creating || projectStatus !== 'ready'}
        onClick={() => void refreshCycles(project.id)}><RefreshCw size={14} aria-hidden="true" />Refresh cycles</button>
      {!showForm && <button ref={buttonRef} className="primary-button" type="button" disabled={cycleStatus !== 'ready' || projectStatus !== 'ready'}
        onClick={() => setShowForm(true)}><Plus size={15} aria-hidden="true" />New cycle</button>}
    </div>
    {showForm && <CreationForm kind="cycle" onCancel={() => setShowForm(false)} onBusyChange={setCreating}
      onCreate={async (name) => {
        const cycle = await createCycle(project.id, { name });
        setShowForm(false);
        announce(`Cycle “${cycle.name}” created for project “${project.name}”.`);
      }} />}
    {(cycleStatus === 'loading' || cycleStatus === 'idle') && <LoadingState>Loading upload cycles…</LoadingState>}
    {cycleError && <RequestError title="Could not load upload cycles" error={cycleError} onRetry={() => void refreshCycles(project.id)} />}
    <div aria-busy={cycleStatus === 'loading'}>
      {cycleStatus === 'ready' && !cycles.length && <div className="panel-empty"><Layers3 size={27} aria-hidden="true" /><h3>No upload cycles yet</h3><p>Create a cycle for this project to organize a run. No reports are uploaded here.</p></div>}
      {!!cycles.length && <ul className="workspace-records" aria-label={`Upload cycles for ${project.name}`}>
        {cycles.map((cycle) => <li key={cycle.id} className={`workspace-record${cycle.id === selectedCycleId ? ' workspace-record-selected' : ''}`}>
          <div className="record-title-row"><h3>{cycle.name}</h3>{cycle.id === selectedCycleId && <span className="selection-badge"><Check size={12} aria-hidden="true" />Active cycle</span>}</div>
          <p className="record-meta">Created <time dateTime={cycle.created_at} title="UTC date">{createdDate(cycle.created_at)}</time></p>
          <p className="ingestion-label">Ingestion: <span>{cycle.ingestion_status}</span></p>
          <button className="secondary-button record-select" type="button" aria-label={`Select cycle ${cycle.name}`} aria-pressed={cycle.id === selectedCycleId}
            disabled={cycleStatus !== 'ready' || projectStatus !== 'ready'} onClick={() => { selectCycle(cycle.id); announce(`Active cycle: ${cycle.name}.`); }}>
            {cycle.id === selectedCycleId ? <><Check size={14} aria-hidden="true" />Selected</> : 'Use this cycle'}
          </button>
        </li>)}
      </ul>}
    </div>
    <p className="panel-footnote">Ingestion status is supplied by the API. “Complete” means both source reports were ingested; it does not mean review is complete.</p>
  </section>;
}

export function ProjectsPage() {
  const { projects, projectStatus, projectError, selectedProject, selectedProjectId,
    selectedCycle, refreshProjects, selectProject, createProject } = useWorkspace();
  const { showForm, setShowForm, creating, setCreating, buttonRef } = useCreationPanel();
  const [message, setMessage] = useState('');

  useEffect(() => { void refreshProjects(); }, [refreshProjects]);

  return <div className="page-content projects-page">
    <section className="overview-introduction" aria-labelledby="projects-page-heading">
      <h1 id="projects-page-heading">Projects</h1>
      <p>Choose a project, then select an upload cycle to set your workspace.</p>
    </section>
    <div className="workspace-selection" aria-label="Current workspace">
      <FolderOpen size={21} aria-hidden="true" />
      <div><span className="panel-eyebrow">Current workspace</span>
        <p>{selectedProject ? <><strong>{selectedProject.name}</strong><span className="workspace-separator">/</span>{selectedCycle ? selectedCycle.name : 'No cycle selected'}</> : 'No project selected'}</p>
        <span className="selection-hint">Selection stays while this app is open and resets on reload.</span>
      </div>
    </div>
    <div className={`workspace-announcement${message ? ' workspace-announcement-visible' : ''}`} role="status" aria-live="polite" aria-atomic="true">
      {message && <><CheckCircle2 size={16} aria-hidden="true" /><span>{message}</span></>}
    </div>
    <div className="projects-grid">
      <section className="workspace-panel" aria-labelledby="project-list-heading">
        <div className="panel-heading"><div className="panel-heading-copy"><span className="panel-eyebrow">Workspace directory</span><h2 id="project-list-heading">Your projects</h2></div><FolderKanban size={22} className="panel-heading-icon" aria-hidden="true" /></div>
        <p className="panel-description">Keep each engagement and its upload cycles in one place.</p>
        <div className="panel-toolbar">
          <button className="secondary-button" type="button" disabled={projectStatus === 'loading' || creating}
            onClick={() => void refreshProjects()}><RefreshCw size={14} aria-hidden="true" />Refresh projects</button>
          {!showForm && <button ref={buttonRef} className="primary-button" type="button" disabled={projectStatus !== 'ready'}
            onClick={() => setShowForm(true)}><Plus size={15} aria-hidden="true" />New project</button>}
        </div>
        {showForm && <CreationForm kind="project" onBusyChange={setCreating} onCancel={() => setShowForm(false)}
          onCreate={async (name, description) => {
            const project = await createProject({ name, description });
            setShowForm(false);
            setMessage(`Project “${project.name}” created and selected.`);
          }} />}
        {(projectStatus === 'idle' || projectStatus === 'loading') && <LoadingState>Loading projects…</LoadingState>}
        {projectError && <RequestError title="Could not load projects" error={projectError} onRetry={() => void refreshProjects()} />}
        <div aria-busy={projectStatus === 'loading'}>
          {projectStatus === 'ready' && !projects.length && <div className="panel-empty"><FolderOpen size={28} aria-hidden="true" /><h3>No projects yet</h3><p>Create your first project with a name and an optional description. Your projects will appear here.</p></div>}
          {!!projects.length && <ul className="workspace-records" aria-label="Projects">
            {projects.map((project) => <li key={project.id} className={`workspace-record${project.id === selectedProjectId ? ' workspace-record-selected' : ''}`}>
              <div className="record-title-row"><h3>{project.name}</h3>{project.id === selectedProjectId && <span className="selection-badge"><Check size={12} aria-hidden="true" />Selected project</span>}</div>
              {project.description && <p className="record-description">{project.description}</p>}
              <p className="record-meta">Created <time dateTime={project.created_at} title="UTC date">{createdDate(project.created_at)}</time></p>
              <button className="secondary-button record-select" type="button" aria-label={`Select project ${project.name}`} aria-pressed={project.id === selectedProjectId}
                disabled={projectStatus !== 'ready'} onClick={() => { selectProject(project.id); setMessage(`Selected project: ${project.name}.`); }}>
                {project.id === selectedProjectId ? <><Check size={14} aria-hidden="true" />Selected</> : 'Select project'}
              </button>
            </li>)}
          </ul>}
        </div>
      </section>
      {selectedProject ? <CyclesPanel key={selectedProject.id} project={selectedProject} announce={setMessage} />
        : <section className="workspace-panel cycle-start" aria-labelledby="cycle-start-heading"><span className="empty-icon"><Layers3 size={27} aria-hidden="true" /></span>
          <h2 id="cycle-start-heading">Select a project to view cycles</h2><p>Each upload cycle belongs to one project. Choose a project from the directory to create or select its cycles.</p>
        </section>}
    </div>
  </div>;
}
