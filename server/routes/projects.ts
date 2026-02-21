import { Router, Request, Response, RequestHandler } from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  getProjectStatus,
  stageFiles,
  unstageFiles,
  stageAllFiles,
  unstageAllFiles,
  commitChanges,
  checkoutBranch,
  createBranch,
  mergeDevToMain
} from '../services/gitService';
import { logger, LogCategory } from '../logger';

const router = Router();

interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  locked?: boolean;
}

interface AppConfig {
  pollInterval: number;
  projects: ProjectConfig[];
}

function loadConfig(): AppConfig {
  const configPath = join(process.cwd(), 'config.json');
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    logger.debug(LogCategory.CONFIG, 'Config loaded successfully');
    return JSON.parse(configContent);
  } catch (error: any) {
    logger.error(LogCategory.CONFIG, 'Failed to load config', {
      error: error.message,
      path: configPath
    });
    throw error;
  }
}

function findProject(id: string): ProjectConfig | undefined {
  const config = loadConfig();
  return config.projects.find(p => p.id === id);
}

// GET /api/projects - Список всех проектов с их статусами
router.get('/', async (req: Request, res: Response) => {
  try {
    logger.debug(LogCategory.API, 'GET /api/projects - fetching all projects');
    const config = loadConfig();
    const projects = await Promise.all(
      config.projects.map(p => getProjectStatus(p))
    );
    logger.info(LogCategory.API, 'Projects loaded successfully', {
      count: projects.length
    });
    res.json({ projects, pollInterval: config.pollInterval });
  } catch (error: any) {
    logger.error(LogCategory.API, 'Error loading projects', {
      error: error.message
    });
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

// GET /api/projects/:id/status - Статус конкретного проекта
router.get('/:id/status', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const projectId = req.params.id;
    logger.debug(LogCategory.API, `GET /api/projects/${projectId}/status`);
    
    const project = findProject(projectId);
    if (!project) {
      logger.warn(LogCategory.API, 'Project not found', { projectId });
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const status = await getProjectStatus(project);
    // logger.info(LogCategory.API, 'Project status retrieved', {
    //   projectId,
    //   projectName: project.name,
    //   branch: status.branch
    // });
    res.json(status);
  } catch (error: any) {
    logger.error(LogCategory.API, 'Error getting project status', {
      projectId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to get project status' });
  }
});

// POST /api/projects/:id/stage - Stage файлов
router.post('/:id/stage', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const projectId = req.params.id;
    const project = findProject(projectId);
    if (!project) {
      logger.warn(LogCategory.API, 'Project not found', { projectId });
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { files, all } = req.body;
    
    if (all) {
      logger.info(LogCategory.GIT, 'Staging all files', {
        projectId,
        projectName: project.name
      });
      await stageAllFiles(project.path);
    } else if (files && Array.isArray(files)) {
      logger.info(LogCategory.GIT, 'Staging files', {
        projectId,
        projectName: project.name,
        filesCount: files.length
      });
      await stageFiles(project.path, files);
    } else {
      logger.warn(LogCategory.API, 'Invalid stage request - no files specified', {
        projectId
      });
      return res.status(400).json({ error: 'Files array or all flag required' });
    }
    
    const status = await getProjectStatus(project);
    res.json(status);
  } catch (error: any) {
    logger.error(LogCategory.GIT, 'Error staging files', {
      projectId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to stage files' });
  }
});

// POST /api/projects/:id/unstage - Unstage файлов
router.post('/:id/unstage', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const projectId = req.params.id;
    const project = findProject(projectId);
    if (!project) {
      logger.warn(LogCategory.API, 'Project not found', { projectId });
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { files, all } = req.body;
    
    if (all) {
      logger.info(LogCategory.GIT, 'Unstaging all files', {
        projectId,
        projectName: project.name
      });
      await unstageAllFiles(project.path);
    } else if (files && Array.isArray(files)) {
      logger.info(LogCategory.GIT, 'Unstaging files', {
        projectId,
        projectName: project.name,
        filesCount: files.length
      });
      await unstageFiles(project.path, files);
    } else {
      logger.warn(LogCategory.API, 'Invalid unstage request - no files specified', {
        projectId
      });
      return res.status(400).json({ error: 'Files array or all flag required' });
    }
    
    const status = await getProjectStatus(project);
    res.json(status);
  } catch (error: any) {
    logger.error(LogCategory.GIT, 'Error unstaging files', {
      projectId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to unstage files' });
  }
});

// POST /api/projects/:id/commit - Commit изменений
router.post('/:id/commit', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const projectId = req.params.id;
    const project = findProject(projectId);
    if (!project) {
      logger.warn(LogCategory.API, 'Project not found', { projectId });
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (project.locked) {
      logger.warn(LogCategory.API, 'Project is locked', { projectId, projectName: project.name });
      return res.status(403).json({ error: 'Project is locked. Unlock it in config to commit changes.' });
    }
    
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      logger.warn(LogCategory.API, 'Invalid commit request - no message', {
        projectId
      });
      return res.status(400).json({ error: 'Commit message required' });
    }
    
    logger.info(LogCategory.GIT, 'Committing changes', {
      projectId,
      projectName: project.name,
      message: message.substring(0, 50)
    });
    
    await commitChanges(project.path, message);
    
    logger.info(LogCategory.GIT, 'Commit successful', {
      projectId,
      projectName: project.name,
      message: message.substring(0, 50)
    });
    
    const status = await getProjectStatus(project);
    res.json({ ...status, commitSuccess: true, commitMessage: 'Changes committed successfully' });
  } catch (error: any) {
    logger.error(LogCategory.GIT, 'Error committing changes', {
      projectId: req.params.id,
      error: error.message
    });
    // Extract detailed error message from Git
    const gitMessage = error?.message || error?.toString() || '';
    let detailedError = 'Unknown error occurred';
    
    if (gitMessage.includes('nothing to commit')) {
      detailedError = 'Nothing to commit. Stage some files first.';
    } else if (gitMessage.includes('Please tell me who you are')) {
      detailedError = 'Git user not configured. Run: git config user.name "Your Name" && git config user.email "your@email.com"';
    } else if (gitMessage.includes('error:')) {
      detailedError = gitMessage.split('error:').slice(1).join('error:').trim();
    } else if (gitMessage) {
      detailedError = gitMessage;
    }
    
    res.status(500).json({ 
      error: 'Failed to commit changes',
      details: detailedError
    });
  }
});

// POST /api/projects/:id/commit-all - Stage all and commit
router.post('/:id/commit-all', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const projectId = req.params.id;
    const project = findProject(projectId);
    if (!project) {
      logger.warn(LogCategory.API, 'Project not found', { projectId });
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (project.locked) {
      logger.warn(LogCategory.API, 'Project is locked', { projectId, projectName: project.name });
      return res.status(403).json({ error: 'Project is locked. Unlock it in config to commit changes.' });
    }
    
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      logger.warn(LogCategory.API, 'Invalid commit-all request - no message', {
        projectId
      });
      return res.status(400).json({ error: 'Commit message required' });
    }
    
    logger.info(LogCategory.GIT, 'Staging all and committing', {
      projectId,
      projectName: project.name,
      message: message.substring(0, 50)
    });
    
    // Stage all tracked files
    await stageAllFiles(project.path);
    
    // Commit
    await commitChanges(project.path, message);
    
    logger.info(LogCategory.GIT, 'Commit all successful', {
      projectId,
      projectName: project.name,
      message: message.substring(0, 50)
    });
    
    const status = await getProjectStatus(project);
    res.json({ ...status, commitSuccess: true, commitMessage: 'All changes committed successfully' });
  } catch (error: any) {
    logger.error(LogCategory.GIT, 'Error in commit-all', {
      projectId: req.params.id,
      error: error.message
    });
    // Extract detailed error message from Git
    const gitMessage = error?.message || error?.toString() || '';
    let detailedError = 'Unknown error occurred';
    
    if (gitMessage.includes('nothing to commit')) {
      detailedError = 'No changes to commit.';
    } else if (gitMessage.includes('Please tell me who you are')) {
      detailedError = 'Git user not configured. Run: git config user.name "Your Name" && git config user.email "your@email.com"';
    } else if (gitMessage.includes('error:')) {
      detailedError = gitMessage.split('error:').slice(1).join('error:').trim();
    } else if (gitMessage) {
      detailedError = gitMessage;
    }
    
    res.status(500).json({ 
      error: 'Failed to commit all changes',
      details: detailedError
    });
  }
});

// POST /api/projects/:id/checkout - Переключение ветки
router.post('/:id/checkout', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const projectId = req.params.id;
    const project = findProject(projectId);
    if (!project) {
      logger.warn(LogCategory.API, 'Project not found', { projectId });
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (project.locked) {
      logger.warn(LogCategory.API, 'Project is locked', { projectId, projectName: project.name });
      return res.status(403).json({ error: 'Project is locked. Unlock it in config to switch branches.' });
    }
    
    const { branch } = req.body;
    if (!branch || typeof branch !== 'string') {
      logger.warn(LogCategory.API, 'Invalid checkout request - no branch', {
        projectId
      });
      return res.status(400).json({ error: 'Branch name required' });
    }
    
    logger.info(LogCategory.GIT, 'Checking out branch', {
      projectId,
      projectName: project.name,
      branch
    });
    
    await checkoutBranch(project.path, branch);
    const status = await getProjectStatus(project);
    res.json(status);
  } catch (error: any) {
    logger.error(LogCategory.GIT, 'Error checking out branch', {
      projectId: req.params.id,
      error: error.message
    });
    // Extract detailed error message from Git
    const gitMessage = error?.message || error?.toString() || '';
    const detailedError = gitMessage.includes('error:') 
      ? gitMessage.split('error:').slice(1).join('error:').trim()
      : gitMessage;
    res.status(500).json({ 
      error: 'Failed to checkout branch',
      details: detailedError || 'Unknown error occurred'
    });
  }
});

// POST /api/projects/:id/create-branch - Создание новой ветки
router.post('/:id/create-branch', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const projectId = req.params.id;
    const project = findProject(projectId);
    if (!project) {
      logger.warn(LogCategory.API, 'Project not found', { projectId });
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (project.locked) {
      logger.warn(LogCategory.API, 'Project is locked', { projectId, projectName: project.name });
      return res.status(403).json({ error: 'Project is locked. Unlock it in config to create branches.' });
    }
    
    const { branchName } = req.body;
    if (!branchName || typeof branchName !== 'string') {
      logger.warn(LogCategory.API, 'Invalid create-branch request - no branch name', {
        projectId
      });
      return res.status(400).json({ error: 'Branch name required' });
    }
    
    logger.info(LogCategory.GIT, 'Creating new branch', {
      projectId,
      projectName: project.name,
      branchName
    });
    
    await createBranch(project.path, branchName);
    const status = await getProjectStatus(project);
    res.json(status);
  } catch (error: any) {
    logger.error(LogCategory.GIT, 'Error creating branch', {
      projectId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// POST /api/projects/:id/merge-dev-to-main - Merge dev into main with checks
router.post('/:id/merge-dev-to-main', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const projectId = req.params.id;
    const project = findProject(projectId);
    if (!project) {
      logger.warn(LogCategory.API, 'Project not found', { projectId });
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (project.locked) {
      logger.warn(LogCategory.API, 'Project is locked', { projectId, projectName: project.name });
      return res.status(403).json({ error: 'Project is locked. Unlock it in config to merge branches.' });
    }
    
    logger.info(LogCategory.GIT, 'Starting dev->main merge', {
      projectId,
      projectName: project.name
    });
    
    const result = await mergeDevToMain(project.path);
    
    if (result.success) {
      logger.info(LogCategory.GIT, 'dev->main merge successful', {
        projectId,
        projectName: project.name
      });
      const status = await getProjectStatus(project);
      res.json({ 
        ...status, 
        mergeSuccess: true, 
        mergeReport: result.report 
      });
    } else {
      logger.warn(LogCategory.GIT, 'dev->main merge failed', {
        projectId,
        projectName: project.name,
        error: result.error
      });
      res.status(400).json({ 
        error: result.error || 'Merge operation failed',
        report: result.report
      });
    }
  } catch (error: any) {
    logger.error(LogCategory.GIT, 'Error in dev->main merge', {
      projectId: req.params.id,
      error: error.message
    });
    res.status(500).json({ 
      error: 'Failed to merge dev->main',
      details: error.message
    });
  }
});

// POST /api/projects/config - Сохранение config.json
router.post('/config', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    
    // Validate config structure
    if (!config.pollInterval || !Array.isArray(config.projects)) {
      logger.warn(LogCategory.CONFIG, 'Invalid config structure received');
      return res.status(400).json({ error: 'Invalid config structure' });
    }
    
    logger.info(LogCategory.CONFIG, 'Saving config', {
      projectsCount: config.projects.length,
      pollInterval: config.pollInterval
    });
    
    // Write to config.json
    const configPath = join(process.cwd(), 'config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    logger.info(LogCategory.CONFIG, 'Config saved successfully');
    
    // Return updated projects with their statuses
    const projects = await Promise.all(
      config.projects.map((p: ProjectConfig) => getProjectStatus(p))
    );
    
    res.json({ projects, pollInterval: config.pollInterval });
  } catch (error: any) {
    logger.error(LogCategory.CONFIG, 'Error saving config', {
      error: error.message
    });
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

export default router;
