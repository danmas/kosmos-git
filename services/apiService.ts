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

// Checkout to a specific commit (reset current branch or create new branch)
export async function checkoutCommit(projectId: string, hash: string, newBranch?: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/checkout-commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash, newBranch })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.details || errorData.error || 'Failed to checkout commit');
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

export async function deleteBranch(projectId: string, branchName: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/delete-branch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchName })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.details || data.error || 'Failed to delete branch');
  }
  return response.json();
}

// Get raw config.json from server
export async function getConfig(): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/config`);
  if (!response.ok) {
    throw new Error('Failed to fetch config');
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

// Merge dev into main
export async function mergeDevToMain(projectId: string): Promise<{
  success: boolean;
  report: string;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/merge-dev-to-main`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      report: data.report || '',
      error: data.error || data.details || 'Failed to merge dev->main'
    };
  }

  return {
    success: true,
    report: data.mergeReport || 'Merge completed successfully',
    error: undefined
  };
}

// Generic branch merge
export async function mergeBranches(projectId: string, fromBranch: string, toBranch: string): Promise<{
  success: boolean;
  report: string;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/merge-branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromBranch, toBranch })
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      report: data.report || '',
      error: data.error || data.details || 'Failed to merge branches'
    };
  }

  return {
    success: true,
    report: data.mergeReport || 'Merge completed successfully',
    error: undefined
  };
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

// Get file content
export async function getFileContent(projectId: string, filePath: string): Promise<string> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/file?path=${encodeURIComponent(filePath)}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch file content');
  }
  const data = await response.json();
  return data.content;
}

// Get file diff
export async function getFileDiff(projectId: string, filePath: string, staged: boolean = false, hash?: string): Promise<string> {
  let url = `${API_BASE}/projects/${projectId}/diff?path=${encodeURIComponent(filePath)}&staged=${staged}`;
  if (hash) {
    url += `&hash=${encodeURIComponent(hash)}`;
  }
  const response = await fetch(url);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch file diff');
  }
  const data = await response.json();
  return data.diff;
}

// Get branch commits
export async function getBranchCommits(projectId: string, branch?: string, limit?: number): Promise<any[]> {
  let url = `${API_BASE}/projects/${projectId}/commits`;
  const params = [];
  if (branch) params.push(`branch=${encodeURIComponent(branch)}`);
  if (limit) params.push(`limit=${limit}`);
  if (params.length > 0) url += `?${params.join('&')}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch branch commits');
  }
  const data = await response.json();
  return data.commits;
}

// Search commits
export async function searchCommits(projectId: string, query: string, since?: string, maxCount?: number): Promise<any[]> {
  let url = `${API_BASE}/projects/${projectId}/commits/search?q=${encodeURIComponent(query)}`;
  if (since) url += `&since=${encodeURIComponent(since)}`;
  if (maxCount) url += `&maxCount=${maxCount}`;
  const response = await fetch(url);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to search commits');
  }
  const data = await response.json();
  return data.commits;
}

// Get commit details
export async function getCommitDetails(projectId: string, hash: string): Promise<{ commit: any; files: any[] }> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/commits/${encodeURIComponent(hash)}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to get commit details');
  }
  return response.json();
}

// Checkout a single file (discard changes)
export async function checkoutFile(projectId: string, filePath: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/checkout-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.details || errorData.error || 'Failed to checkout file');
  }
  return response.json();
}

// Push changes to remote
export async function pushChanges(projectId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      message: data.error || data.details || 'Failed to push changes'
    };
  }

  return {
    success: true,
    message: data.pushMessage || 'Push completed successfully'
  };
}

