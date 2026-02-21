import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { existsSync } from 'fs';
import projectsRouter from './routes/projects';

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

// Production: serve built frontend
if (!isDev) {
  const distPath = join(process.cwd(), 'dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(join(distPath, 'index.html'));
    });
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GitLens API server running on http://localhost:${PORT}`);
  console.log(`📁 Health check: http://localhost:${PORT}/api/health`);
  if (!isDev) {
    console.log(`🌐 Frontend served at http://localhost:${PORT}`);
  }
});
