import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { GitStatus, FileChangeType, FileChange, Project } from '../../types';
import { logger, LogCategory } from '../logger';

interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  locked?: boolean;
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
      lastCommitDate: log?.latest?.date ? formatDate(log.latest.date) : undefined,
      locked: project.locked
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
      lastCommitMessage: 'Unable to read repository',
      locked: project.locked
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

export async function deleteBranch(projectPath: string, branchName: string): Promise<void> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  logger.debug(LogCategory.GIT, 'Deleting branch', {
    path: resolvedPath,
    branchName
  });
  await git.deleteLocalBranch(branchName, true);
}

export async function mergeDevToMain(projectPath: string): Promise<{
  success: boolean;
  report: string;
  error?: string;
}> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  const report: string[] = [];

  try {
    logger.info(LogCategory.GIT, 'Starting dev->main merge operation', { path: resolvedPath });

    // Step 1: Check current branch
    const status = await git.status();
    if (status.current !== 'dev') {
      return {
        success: false,
        report: 'Error: Not on dev branch',
        error: `Current branch is '${status.current}', but must be on 'dev' branch`
      };
    }
    report.push('✓ Currently on dev branch');

    // Step 2: Check dev is clean (all committed)
    if (status.files.length > 0) {
      return {
        success: false,
        report: report.join('\n') + '\n✗ Error: Uncommitted changes in dev branch',
        error: 'Dev branch has uncommitted changes. Please commit or stash them first.'
      };
    }
    report.push('✓ Dev branch is clean (all committed)');

    // Step 3: Fetch latest (optional, to be safe)
    await git.fetch();
    report.push('✓ Fetched latest changes from remote');

    // Step 4: Checkout main
    await git.checkout('main');
    report.push('✓ Switched to main branch');

    // Step 5: Check main is clean
    const mainStatus = await git.status();
    if (mainStatus.files.length > 0) {
      // Go back to dev
      await git.checkout('dev');
      return {
        success: false,
        report: report.join('\n') + '\n✗ Error: Uncommitted changes in main branch',
        error: 'Main branch has uncommitted changes. Please clean it first.'
      };
    }
    report.push('✓ Main branch is clean (all committed)');

    // Step 6: Merge dev into main
    try {
      await git.merge(['dev']);
      report.push('✓ Merged dev into main');
    } catch (mergeError: any) {
      // Go back to dev on merge error
      await git.checkout('dev');
      return {
        success: false,
        report: report.join('\n') + '\n✗ Merge failed',
        error: `Merge conflict or error: ${mergeError.message}`
      };
    }

    // Step 7: Push main
    try {
      await git.push('origin', 'main');
      report.push('✓ Pushed main to remote');
    } catch (pushError: any) {
      // Stay on main but report push error
      await git.checkout('dev');
      return {
        success: false,
        report: report.join('\n') + '\n✗ Push failed',
        error: `Failed to push main: ${pushError.message}`
      };
    }

    // Step 8: Return to dev
    await git.checkout('dev');
    report.push('✓ Returned to dev branch');

    report.push('\n✓ SUCCESS: dev merged into main and pushed!');

    logger.info(LogCategory.GIT, 'dev->main merge completed successfully', { path: resolvedPath });

    return {
      success: true,
      report: report.join('\n')
    };
  } catch (error: any) {
    logger.error(LogCategory.GIT, 'dev->main merge failed', {
      path: resolvedPath,
      error: error.message
    });

    // Try to return to dev on any unexpected error
    try {
      await git.checkout('dev');
      report.push('✓ Returned to dev branch after error');
    } catch (checkoutError) {
      report.push('✗ Failed to return to dev branch');
    }

    return {
      success: false,
      report: report.join('\n'),
      error: error.message
    };
  }
}

export async function mergeBranches(projectPath: string, fromBranch: string, toBranch: string): Promise<{
  success: boolean;
  report: string;
  error?: string;
}> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  const report: string[] = [];

  try {
    logger.info(LogCategory.GIT, `Starting generic merge: ${fromBranch} -> ${toBranch}`, { path: resolvedPath });

    // Get current branch to return later
    const status = await git.status();
    const originalBranch = status.current;

    // Step 1: Checkout toBranch
    await git.checkout(toBranch);
    report.push(`✓ Switched to target branch: ${toBranch}`);

    // Step 2: Merge fromBranch
    try {
      await git.merge([fromBranch]);
      report.push(`✓ Merged ${fromBranch} into ${toBranch}`);
    } catch (mergeError: any) {
      // Attempt to abort the merge on conflict
      try {
        await git.merge(['--abort']);
        report.push('✓ Merge aborted due to conflict');
      } catch (abortError) {
        report.push('✗ Failed to abort merge cleanly');
      }

      // Return to original branch if possible
      if (originalBranch && originalBranch !== toBranch) {
        await git.checkout(originalBranch);
        report.push(`✓ Returned to original branch: ${originalBranch}`);
      }
      return {
        success: false,
        report: report.join('\n') + `\n✗ Merge failed: ${mergeError.message}`,
        error: `Merge conflict or error during merge of '${fromBranch}' into '${toBranch}'`
      };
    }

    // Still on toBranch, return to original
    if (originalBranch && originalBranch !== toBranch) {
      await git.checkout(originalBranch);
      report.push(`✓ Returned to original branch: ${originalBranch}`);
    }

    report.push(`\n✓ SUCCESS: ${fromBranch} merged into ${toBranch}!`);
    return {
      success: true,
      report: report.join('\n')
    };
  } catch (error: any) {
    logger.error(LogCategory.GIT, 'Generic merge failed', {
      path: resolvedPath,
      fromBranch,
      toBranch,
      error: error.message
    });
    return {
      success: false,
      report: report.join('\n'),
      error: error.message
    };
  }
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

import { join } from 'path';
import { readFileSync, existsSync, statSync } from 'fs';

export async function getFileContent(projectPath: string, filePath: string): Promise<string> {
  const resolvedPath = resolveProjectPath(projectPath);
  const fullPath = join(resolvedPath, filePath);

  try {
    if (!existsSync(fullPath)) {
      return '(File not found or deleted)';
    }
    const stat = statSync(fullPath);
    if (stat.size > 2 * 1024 * 1024) return '(File is too large to display)';

    // Read up to 8KB to check if binary
    const fd = require('fs').openSync(fullPath, 'r');
    const buffer = Buffer.alloc(8192);
    const bytesRead = require('fs').readSync(fd, buffer, 0, 8192, 0);
    require('fs').closeSync(fd);

    // Check for null bytes which usually indicates a binary file
    if (buffer.subarray(0, bytesRead).includes(0)) {
      return '(Binary file not displayed)';
    }

    return readFileSync(fullPath, 'utf8');
  } catch (err: any) {
    return `(Error reading file: ${err.message})`;
  }
}

export async function getFileDiff(projectPath: string, filePath: string, staged: boolean = false, hash?: string): Promise<string> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  try {
    let diff = '';

    const status = await git.status();
    const isUntracked = status.not_added.includes(filePath);

    if (hash) {
      diff = await git.raw(['show', '--format=', hash, '--', filePath]);
    } else if (isUntracked) {
      const content = await getFileContent(projectPath, filePath);
      if (content.startsWith('(')) return content; // Return error or binary info
      const lines = content.split('\n');
      diff = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(l => '+' + l).join('\n')}`;
    } else {
      if (staged) {
        diff = await git.diff(['--staged', '--', filePath]);
      } else {
        diff = await git.diff(['--', filePath]);
        if (!diff) {
          diff = await git.diff(['HEAD', '--', filePath]);
        }
      }
    }
    return diff || 'No differences found.';
  } catch (err: any) {
    throw new Error('Could not get diff: ' + err.message);
  }
}

export async function searchCommits(projectPath: string, query: string): Promise<any[]> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  
  if (!query) return [];

  logger.info(LogCategory.GIT, `Searching commits for query: "${query}"`, { path: resolvedPath });
  console.log(`[GIT SEARCH] Начали поиск коммитов по тексту: "${query}"...`);

  // Escape regex special characters for -G search
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let logMsg: any = { all: [] };
  let logPickaxe: any = { all: [] };
  let logDiff: any = { all: [] };

  const searchTasks = [
    git.log(['-i', `--grep=${query}`])
      .then(res => {
        logMsg = res;
        console.log(`[GIT SEARCH] Найдено по тексту коммита: ${res.all.length}`);
      })
      .catch(err => {
        console.error(`[GIT SEARCH ERR] Ошибка поиска по сообщениям коммита:`, err.message);
        throw err;
      }),
    git.log(['-i', `-S${query}`])
      .then(res => {
        logPickaxe = res;
        console.log(`[GIT SEARCH] Найдено по pickaxe (-S): ${res.all.length}`);
      })
      .catch(err => {
        console.error(`[GIT SEARCH ERR] Ошибка поиска по pickaxe:`, err.message);
        throw err;
      }),
    git.log(['-i', `-G${escapedQuery}`])
      .then(res => {
        logDiff = res;
        console.log(`[GIT SEARCH] Найдено по содержимому (diff, -G): ${res.all.length}`);
      })
      .catch(err => {
        console.error(`[GIT SEARCH ERR] Ошибка поиска по -G:`, err.message);
        throw err;
      })
  ];

  try {
    // Ждем все таски. Используем Settled, чтобы не все упало если одна упадет.
    await Promise.allSettled(searchTasks);
  } catch (err) {
    // fail silently as results will be processed from those tasks that succeeded
  }


  const hashes = new Set();
  const results: any[] = [];

  const addCommits = (commits: readonly any[]) => {
    for (const c of commits) {
      if (!hashes.has(c.hash)) {
        hashes.add(c.hash);
        results.push(c);
      }
    }
  };

  addCommits(logMsg.all || []);
  addCommits(logPickaxe.all || []);
  addCommits(logDiff.all || []);

  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return results;
}

export async function getCommitDetails(projectPath: string, hash: string): Promise<any> {
  const resolvedPath = resolveProjectPath(projectPath);
  const git: SimpleGit = simpleGit(resolvedPath);
  
  const log = await git.log({ maxCount: 1, hash }).catch(() => null);
  const commit = log?.latest || null;

  let files: { status: string, path: string }[] = [];
  try {
    const diffTree = await git.raw(['diff-tree', '--no-commit-id', '--name-status', '-r', hash]);
    files = diffTree.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.split('\t');
      return { status: parts[0].charAt(0), path: parts.slice(1).join('\t') };
    });
  } catch (e) {
    // ignore
  }

  return { commit, files };
}
