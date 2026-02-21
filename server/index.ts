import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import projectsRouter from './routes/projects';
import { logger, LogCategory } from './logger';

const app = express();
const PORT = process.env.PORT || 3006;
const isDev = process.env.NODE_ENV !== 'production';

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/projects', projectsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/logs - Get log files list or specific log file content
app.get('/api/logs', (req, res) => {
  try {
    const { category, date } = req.query;
    const logsDir = join(process.cwd(), 'logs');

    // Create logs directory if it doesn't exist
    if (!existsSync(logsDir)) {
      return res.json({ files: [] });
    }

    // If no parameters - return list of available log files
    if (!category && !date) {
      const files = readdirSync(logsDir)
        .filter(f => f.endsWith('.log'))
        .map(f => {
          const match = f.match(/^(.+)-(\d{4}-\d{2}-\d{2})\.log$/);
          return {
            filename: f,
            category: match?.[1] || 'unknown',
            date: match?.[2] || 'unknown',
            path: `/api/logs?category=${match?.[1]}&date=${match?.[2]}`
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));
      
      logger.debug(LogCategory.API, 'Listed log files', { count: files.length });
      return res.json({ files });
    }

    // If parameters provided - return specific log file content
    const today = new Date().toISOString().split('T')[0];
    const logDate = date || today;
    const logCategory = category || 'server';
    const logFile = join(logsDir, `${logCategory}-${logDate}.log`);

    if (!existsSync(logFile)) {
      logger.warn(LogCategory.API, 'Log file not found', {
        category: logCategory,
        date: logDate
      });
      return res.status(404).json({ 
        error: 'Log file not found',
        category: logCategory,
        date: logDate
      });
    }

    const content = readFileSync(logFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    logger.debug(LogCategory.API, 'Retrieved log file', {
      category: logCategory,
      date: logDate,
      linesCount: lines.length
    });

    res.json({
      category: logCategory,
      date: logDate,
      lines,
      totalLines: lines.length
    });
  } catch (error: any) {
    logger.error(LogCategory.API, 'Error reading logs', {
      error: error.message
    });
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

// Production: serve built frontend
if (!isDev) {
  const distPath = join(process.cwd(), 'dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    // Fallback to index.html for SPA routes
    app.use((req, res) => {
      res.sendFile(join(distPath, 'index.html'));
    });
  }
}

// Start server
app.listen(PORT, () => {
  logger.info(LogCategory.SERVER, `GitLens API server started on http://localhost:${PORT}`, {
    port: PORT,
    mode: isDev ? 'development' : 'production'
  });
  logger.info(LogCategory.SERVER, `Health check available at: /api/health`);
  if (!isDev) {
    logger.info(LogCategory.SERVER, 'Frontend served from dist/');
  }
  
  // Keep console.log for user-friendly output
  console.log(`🚀 GitLens API server running on http://localhost:${PORT}`);
  console.log(`📁 Health check: http://localhost:${PORT}/api/health`);
  if (!isDev) {
    console.log(`🌐 Frontend served at http://localhost:${PORT}`);
  }
}).on('error', (error: any) => {
  logger.error(LogCategory.SERVER, 'Failed to start server', {
    error: error.message,
    code: error.code,
    port: PORT
  });
  process.exit(1);
});
