
export enum GitStatus {
  CLEAN = 'CLEAN',
  DIRTY = 'DIRTY',
  AHEAD = 'AHEAD',
  CONFLICT = 'CONFLICT'
}

export enum FileChangeType {
  MODIFIED = 'M',
  ADDED = 'A',
  DELETED = 'D',
  RENAMED = 'R'
}

export interface FileChange {
  path: string;
  type: FileChangeType;
  staged: boolean;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  branch: string;
  branches: string[]; // List of available branches
  status: GitStatus;
  changes: FileChange[];
  lastCommitMessage?: string;
  lastCommitDate?: string;
  locked?: boolean; // If true, project is locked for commits and branch changes
}

export interface AppSettings {
  projects: Array<{ id: string; name: string; path: string; locked?: boolean }>;
  pollInterval: number; // seconds
}

export interface AppState {
  projects: Project[];
  activeProjectId: string | null;
  settings: AppSettings;
  showSettings: boolean;
  showAIAdd: boolean;
}
