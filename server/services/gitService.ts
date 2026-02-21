import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { GitStatus, FileChangeType, FileChange, Project } from '../../types';
import { logger, LogCategory } from '../logger';

interface ProjectConfig {
  id: string;
  name: string;
  path: string;
}

function resolveProjectPath(configPath: string): string {
  // Expand ~ to home directory
  if (configPath.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return configPath.replace('~', home);
  }
  return configPath;
}

function mapFileStatus(status: string): FileChangeType {
  switch (status) {
    case 'M': return FileChangeType.MODIFIED;
    case 'A': return FileChangeType.ADDED;
    case 'D': return FileChangeType.DELETED;
    case 'R': return FileChangeType.RENAMED;
    case '?': return FileChangeType.ADDED; // Untracked files
    default: return FileChangeType.MODIFIED;
  }
}

function parseGitStatus(status: StatusResult): { gitStatus: GitStatus; changes: FileChange[] } {
  const changes: FileChange[] = [];

  // Staged files
  for (const file of status.staged) {
    const fileStatus = status.files.find(f => f.path === file);
    changes.push({
      path: file,
      type: mapFileStatus(fileStatus?.index || 'M'),
      staged: true
    });
  }

  // Modified but not staged
  for (const file of status.modified) {
    if (!status.staged.includes(file)) {
      changes.push({
        path: file,
        type: FileChangeType.MODIFIED,
        staged: false
      });
    }
  }

  // Deleted files
  for (const file of status.deleted) {
    if (!status.staged.includes(file)) {
      changes.push({
        path: file,
        type: FileChangeType.DELETED,
        staged: false
      });
    }
  }

  // Untracked files (new files not added)
  for (const file of status.not_added) {
    changes.push({
      path: file,
      type: FileChangeType.ADDED,
      staged: false
    });
  }

  // Determine overall status
  let gitStatus = GitStatus.CLEAN;
  if (changes.length > 0) {
    gitStatus = GitStatus.DIRTY;
  } else if (status.ahead > 0) {
    gitStatus = GitStatus.AHEAD;
  }

  return { gitStatus, changes };
}

export async function getProjectStatus(project: ProjectConfig): Promise<Project> {
  const projectPath = resolveProjectPath(project.path);
  const git: SimpleGit = simpleGit(projectPath);

  try {
    logger.debug(LogCategory.GIT, `Getting status for project: ${project.name}`, {
      projectId: project.id,
      path: projectPath
    });
    
    const [status, branchSummary, log] = await Promise.all([
      git.status(),
      git.branchLocal(),
      git.log({ maxCount: 1 }).catch(() => null)
    ]);

    const { gitStatus, changes } = parseGitStatus(status);

    return {
      id: project.id,
      name: project.name,
      path: project.path,
      branch: status.current || 'main',
      branches: branchSummary.all,
      status: gitStatus,
      changes,
      lastCommitMessage: log?.latest?.message,
      lastCommitDate: log?.latest?.date ? formatDate(log.latest.date) : undefined
    };
  } catch (error: any) {
    logger.error(LogCategory.GIT, `Error getting status for ${project.name}`, {
      projectId: project.id,
      path: projectPath,
      error: error.message
    });
    return {
      id: project.id,
      name: project.name,
      path: project.path,
      branch: 'unknown',
      branches: [],
      status: GitStatus.CLEAN,
      changes: [],
      lastCommitMessage: 'Unable to read repository'
    };
  }
}

export async function stageFiles(projectPath: string, files: string[]): Promise<void> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  logger.debug(LogCategory.GIT, 'Staging files', {
    path: resolvedPath,
    filesCount: files.length
  });
  await git.add(files);
}

export async function unstageFiles(projectPath: string, files: string[]): Promise<void> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  logger.debug(LogCategory.GIT, 'Unstaging files', {
    path: resolvedPath,
    filesCount: files.length
  });
  await git.reset(['HEAD', '--', ...files]);
}

export async function stageAllFiles(projectPath: string): Promise<void> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  logger.debug(LogCategory.GIT, 'Staging all files', { path: resolvedPath });
  await git.add('-A');
}

export async function unstageAllFiles(projectPath: string): Promise<void> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  logger.debug(LogCategory.GIT, 'Unstaging all files', { path: resolvedPath });
  await git.reset(['HEAD']);
}

export async function commitChanges(projectPath: string, message: string): Promise<void> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  
  // Check if there are staged files before committing
  const status = await git.status();
  if (status.staged.length === 0) {
    throw new Error('Nothing to commit. Stage some files first.');
  }
  
  logger.debug(LogCategory.GIT, 'Committing changes', {
    path: resolvedPath,
    message: message.substring(0, 50),
    stagedFiles: status.staged.length
  });
  
  const result = await git.commit(message);
  
  // Verify commit actually happened
  if (!result.commit) {
    throw new Error('Commit failed - no changes were committed');
  }
}

export async function checkoutBranch(projectPath: string, branch: string): Promise<void> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  logger.debug(LogCategory.GIT, 'Checking out branch', {
    path: resolvedPath,
    branch
  });
  await git.checkout(branch);
}

export async function createBranch(projectPath: string, branchName: string): Promise<void> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  logger.debug(LogCategory.GIT, 'Creating new branch', {
    path: resolvedPath,
    branchName
  });
  await git.checkoutLocalBranch(branchName);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString();
}
