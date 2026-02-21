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
  createBranch
} from '../services/gitService';

const router = Router();

interface ProjectConfig {
  id: string;
  name: string;
  path: string;
}

interface AppConfig {
  pollInterval: number;
  projects: ProjectConfig[];
}

function loadConfig(): AppConfig {
  const configPath = join(process.cwd(), 'config.json');
  const configContent = readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent);
}

function findProject(id: string): ProjectConfig | undefined {
  const config = loadConfig();
  return config.projects.find(p => p.id === id);
}

// GET /api/projects - Список всех проектов с их статусами
router.get('/', async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const projects = await Promise.all(
      config.projects.map(p => getProjectStatus(p))
    );
    res.json({ projects, pollInterval: config.pollInterval });
  } catch (error) {
    console.error('Error loading projects:', error);
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

// GET /api/projects/:id/status - Статус конкретного проекта
router.get('/:id/status', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const project = findProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const status = await getProjectStatus(project);
    res.json(status);
  } catch (error) {
    console.error('Error getting project status:', error);
    res.status(500).json({ error: 'Failed to get project status' });
  }
});

// POST /api/projects/:id/stage - Stage файлов
router.post('/:id/stage', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const project = findProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { files, all } = req.body;
    
    if (all) {
      await stageAllFiles(project.path);
    } else if (files && Array.isArray(files)) {
      await stageFiles(project.path, files);
    } else {
      return res.status(400).json({ error: 'Files array or all flag required' });
    }
    
    const status = await getProjectStatus(project);
    res.json(status);
  } catch (error) {
    console.error('Error staging files:', error);
    res.status(500).json({ error: 'Failed to stage files' });
  }
});

// POST /api/projects/:id/unstage - Unstage файлов
router.post('/:id/unstage', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const project = findProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { files, all } = req.body;
    
    if (all) {
      await unstageAllFiles(project.path);
    } else if (files && Array.isArray(files)) {
      await unstageFiles(project.path, files);
    } else {
      return res.status(400).json({ error: 'Files array or all flag required' });
    }
    
    const status = await getProjectStatus(project);
    res.json(status);
  } catch (error) {
    console.error('Error unstaging files:', error);
    res.status(500).json({ error: 'Failed to unstage files' });
  }
});

// POST /api/projects/:id/commit - Commit изменений
router.post('/:id/commit', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const project = findProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Commit message required' });
    }
    
    await commitChanges(project.path, message);
    const status = await getProjectStatus(project);
    res.json(status);
  } catch (error) {
    console.error('Error committing changes:', error);
    res.status(500).json({ error: 'Failed to commit changes' });
  }
});

// POST /api/projects/:id/checkout - Переключение ветки
router.post('/:id/checkout', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const project = findProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { branch } = req.body;
    if (!branch || typeof branch !== 'string') {
      return res.status(400).json({ error: 'Branch name required' });
    }
    
    await checkoutBranch(project.path, branch);
    const status = await getProjectStatus(project);
    res.json(status);
  } catch (error: any) {
    console.error('Error checking out branch:', error);
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
    const project = findProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { branchName } = req.body;
    if (!branchName || typeof branchName !== 'string') {
      return res.status(400).json({ error: 'Branch name required' });
    }
    
    await createBranch(project.path, branchName);
    const status = await getProjectStatus(project);
    res.json(status);
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// POST /api/projects/config - Сохранение config.json
router.post('/config', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    
    // Validate config structure
    if (!config.pollInterval || !Array.isArray(config.projects)) {
      return res.status(400).json({ error: 'Invalid config structure' });
    }
    
    // Write to config.json
    const configPath = join(process.cwd(), 'config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    // Return updated projects with their statuses
    const projects = await Promise.all(
      config.projects.map((p: ProjectConfig) => getProjectStatus(p))
    );
    
    res.json({ projects, pollInterval: config.pollInterval });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

export default router;
