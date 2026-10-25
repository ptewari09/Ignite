import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ApiError } from '../services/apiClient';
import { workspaceApi, workspaceError } from '../services/workspaceApi';
import type { CycleCreate, Project, ProjectCreate, UploadCycle } from '../types/workspace';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
interface State {
  projects: Project[];
  projectStatus: LoadStatus;
  projectError: ApiError | null;
  cycles: UploadCycle[];
  cycleStatus: LoadStatus;
  cycleError: ApiError | null;
  selectedProjectId: string | null;
  selectedCycleId: string | null;
}

const initialState: State = {
  projects: [], projectStatus: 'idle', projectError: null,
  cycles: [], cycleStatus: 'idle', cycleError: null,
  selectedProjectId: null, selectedCycleId: null,
};

type Action =
  | { type: 'projectsLoading' }
  | { type: 'projectsLoaded'; projects: Project[] }
  | { type: 'projectsFailed'; error: ApiError }
  | { type: 'projectCreated'; project: Project }
  | { type: 'selectProject'; id: string }
  | { type: 'cyclesLoading'; projectId: string }
  | { type: 'cyclesLoaded'; projectId: string; cycles: UploadCycle[] }
  | { type: 'cyclesFailed'; projectId: string; error: ApiError }
  | { type: 'cycleCreated'; cycle: UploadCycle }
  | { type: 'selectCycle'; id: string };

const clearedCycles: Pick<State, 'cycles' | 'cycleStatus' | 'cycleError' | 'selectedCycleId'> = {
  cycles: [], cycleStatus: 'idle', cycleError: null, selectedCycleId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'projectsLoading': return { ...state, projectStatus: 'loading', projectError: null };
    case 'projectsLoaded': {
      const stillExists = action.projects.some((project) => project.id === state.selectedProjectId);
      return { ...state, projects: action.projects, projectStatus: 'ready', projectError: null,
        ...(!stillExists ? { selectedProjectId: null, ...clearedCycles } : {}) };
    }
    case 'projectsFailed': return { ...state, projectStatus: 'error', projectError: action.error };
    case 'projectCreated': return { ...state, projects: [...state.projects.filter((project) => project.id !== action.project.id), action.project], projectStatus: 'ready',
      projectError: null, selectedProjectId: action.project.id, ...clearedCycles };
    case 'selectProject':
      if (state.projectStatus !== 'ready' || !state.projects.some((project) => project.id === action.id)
        || state.selectedProjectId === action.id) return state;
      return { ...state, selectedProjectId: action.id, ...clearedCycles };
    case 'cyclesLoading':
      return state.selectedProjectId === action.projectId ? { ...state, cycleStatus: 'loading', cycleError: null } : state;
    case 'cyclesLoaded':
      return state.selectedProjectId === action.projectId ? { ...state, cycles: action.cycles, cycleStatus: 'ready', cycleError: null,
        selectedCycleId: action.cycles.some((cycle) => cycle.id === state.selectedCycleId) ? state.selectedCycleId : null } : state;
    case 'cyclesFailed':
      return state.selectedProjectId === action.projectId ? { ...state, cycleStatus: 'error', cycleError: action.error,
        ...(action.error.status === 404 ? { selectedProjectId: null, ...clearedCycles,
          projects: state.projects.filter((project) => project.id !== action.projectId),
          projectStatus: 'error', projectError: action.error } : {}) } : state;
    case 'cycleCreated':
      // A response from a form in the previous project must not switch workspaces.
      return state.selectedProjectId === action.cycle.project_id
        ? { ...state, cycles: [...state.cycles.filter((cycle) => cycle.id !== action.cycle.id), action.cycle], cycleStatus: 'ready', cycleError: null, selectedCycleId: action.cycle.id } : state;
    case 'selectCycle':
      return state.cycleStatus === 'ready' && state.projectStatus === 'ready'
        && state.cycles.some((cycle) => cycle.id === action.id && cycle.project_id === state.selectedProjectId)
        ? { ...state, selectedCycleId: action.id } : state;
  }
}

interface Workspace extends State {
  selectedProject: Project | null;
  selectedCycle: UploadCycle | null;
  refreshProjects: () => Promise<void>;
  refreshCycles: (projectId: string) => Promise<void>;
  selectProject: (id: string) => void;
  selectCycle: (id: string) => void;
  createProject: (body: ProjectCreate) => Promise<Project>;
  createCycle: (projectId: string, body: CycleCreate) => Promise<UploadCycle>;
}

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const projectRead = useRef<AbortController | null>(null);
  const cycleRead = useRef<{ controller: AbortController; projectId: string } | null>(null);

  useEffect(() => () => { projectRead.current?.abort(); cycleRead.current?.controller.abort(); }, []);

  const refreshProjects = useCallback(async () => {
    projectRead.current?.abort();
    const controller = new AbortController();
    projectRead.current = controller;
    dispatch({ type: 'projectsLoading' });
    try {
      const projects = await workspaceApi.listProjects(controller.signal);
      if (!controller.signal.aborted) dispatch({ type: 'projectsLoaded', projects });
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: 'projectsFailed', error: workspaceError(error) });
    }
  }, []);

  const refreshCycles = useCallback(async (projectId: string) => {
    cycleRead.current?.controller.abort();
    const controller = new AbortController();
    cycleRead.current = { controller, projectId };
    dispatch({ type: 'cyclesLoading', projectId });
    try {
      const cycles = await workspaceApi.listCycles(projectId, controller.signal);
      if (!controller.signal.aborted) dispatch({ type: 'cyclesLoaded', projectId, cycles });
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: 'cyclesFailed', projectId, error: workspaceError(error) });
    }
  }, []);

  const selectProject = useCallback((id: string) => dispatch({ type: 'selectProject', id }), []);
  const selectCycle = useCallback((id: string) => dispatch({ type: 'selectCycle', id }), []);

  const createProject = useCallback(async (body: ProjectCreate) => {
    const project = await workspaceApi.createProject(body);
    projectRead.current?.abort();
    dispatch({ type: 'projectCreated', project });
    return project;
  }, []);

  const createCycle = useCallback(async (projectId: string, body: CycleCreate) => {
    const cycle = await workspaceApi.createCycle(projectId, body);
    dispatch({ type: 'cycleCreated', cycle });
    // Revalidate the full list after a write, including when a reviewer left and
    // returned during creation. An older form cannot cancel another project's read.
    if (cycleRead.current?.projectId === projectId) void refreshCycles(projectId);
    return cycle;
  }, [refreshCycles]);

  const value = useMemo(() => ({ ...state,
    selectedProject: state.projects.find((project) => project.id === state.selectedProjectId) ?? null,
    selectedCycle: state.cycles.find((cycle) => cycle.id === state.selectedCycleId && cycle.project_id === state.selectedProjectId) ?? null,
    refreshProjects, refreshCycles, selectProject, selectCycle, createProject, createCycle,
  }), [state, refreshProjects, refreshCycles, selectProject, selectCycle, createProject, createCycle]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('useWorkspace must be used within WorkspaceProvider.');
  return workspace;
}
