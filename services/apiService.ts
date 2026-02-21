import { Project } from '../types';

const API_BASE = '/api';

interface ProjectsResponse {
  projects: Project[];
  pollInterval: number;
}

export async function fetchProjects(): Promise<ProjectsResponse> {
  const response = await fetch(`${API_BASE}/projects`);
  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }
  return response.json();
}

export async function fetchProjectStatus(projectId: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/status`);
  if (!response.ok) {
    throw new Error('Failed to fetch project status');
  }
  return response.json();
}

export async function stageFiles(projectId: string, files: string[]): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files })
  });
  if (!response.ok) {
    throw new Error('Failed to stage files');
  }
  return response.json();
}

export async function stageAllFiles(projectId: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ all: true })
  });
  if (!response.ok) {
    throw new Error('Failed to stage all files');
  }
  return response.json();
}

export async function unstageFiles(projectId: string, files: string[]): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/unstage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files })
  });
  if (!response.ok) {
    throw new Error('Failed to unstage files');
  }
  return response.json();
}

export async function unstageAllFiles(projectId: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/unstage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ all: true })
  });
  if (!response.ok) {
    throw new Error('Failed to unstage all files');
  }
  return response.json();
}

export interface CommitResult extends Project {
  commitSuccess?: boolean;
  commitMessage?: string;
}

export async function commitChanges(projectId: string, message: string): Promise<CommitResult> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const details = errorData.details || errorData.error || 'Failed to commit changes';
    throw new Error(details);
  }
  return response.json();
}

export async function commitAllChanges(projectId: string, message: string): Promise<CommitResult> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/commit-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const details = errorData.details || errorData.error || 'Failed to commit changes';
    throw new Error(details);
  }
  return response.json();
}

export async function checkoutBranch(projectId: string, branch: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const details = errorData.details || errorData.error || 'Failed to checkout branch';
    throw new Error(details);
  }
  return response.json();
}

export async function createBranch(projectId: string, branchName: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/create-branch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchName })
  });
  if (!response.ok) {
    throw new Error('Failed to create branch');
  }
  return response.json();
}

// Refresh single project status
export async function refreshProject(projectId: string): Promise<Project> {
  return fetchProjectStatus(projectId);
}

// Refresh all projects
export async function refreshAllProjects(projectIds: string[]): Promise<Project[]> {
  return Promise.all(projectIds.map(id => fetchProjectStatus(id)));
}

// Save config.json to server
export async function saveConfig(config: { pollInterval: number; projects: Array<{ id: string; name: string; path: string }> }): Promise<ProjectsResponse> {
  const response = await fetch(`${API_BASE}/projects/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!response.ok) {
    throw new Error('Failed to save config');
  }
  return response.json();
}
