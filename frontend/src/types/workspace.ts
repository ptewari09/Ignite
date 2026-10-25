// Contracts from backend/app/schemas/ingestion.py. Timestamps are ISO strings.
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadCycle {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  ingestion_status: string;
}

export interface ProjectCreate {
  name: string;
  description?: string | null;
}

export interface CycleCreate {
  name: string;
}
