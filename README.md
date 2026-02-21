# GitLens Dashboard

Git repository manager with status monitoring and branch management.

## Prerequisites

- Node.js (v18 or higher)
- Bun (recommended) or npm

## Installation

```bash
npm install
# or
bun install
```

## Configuration

1. Copy the example config file:
   ```bash
   cp config.json.exemple config.json
   ```

2. Edit `config.json` with your Git project paths:
   ```json
   {
     "pollInterval": 60,
     "projects": [
       {
         "id": "unique-id",
         "name": "Project Name",
         "path": "C:/full/path/to/repo"
       }
     ]
   }
   ```

   **Note:** Use forward slashes (`/`) in paths, even on Windows.

## Running the Application

You need to run **two servers** simultaneously:

### Terminal 1 - Backend API Server (port 3006)
```bash
bun run dev:server
```

### Terminal 2 - Frontend Dev Server (port 3007)
```bash
bun run dev
```

The application will be available at `http://localhost:3007`

## Logging System

The application includes a comprehensive logging system that tracks all operations:

- **Log Files Location:** `logs/` directory
- **File Format:** `<category>-YYYY-MM-DD.log`
- **Categories:** `server`, `api`, `config`, `git`, `project`
- **API Endpoint:** `GET /api/logs` - List all log files
- **Specific Log:** `GET /api/logs?category=server&date=2026-02-21`

**Enable Debug Mode:**
```bash
# Linux/Mac
DEBUG=true bun run dev:server

# Windows PowerShell
$env:DEBUG="true"; bun run dev:server
```

For detailed logging documentation, see [docs/LOGGING.md](./docs/LOGGING.md)

## Build for Production

```bash
bun run build
bun run start
```

**In production:**
- Single Express server on port **3006**
- Serves both API (`/api/*`) and static frontend (`/*` from `dist/`)
- No separate Vite server needed
- Frontend available at `http://localhost:3006`

**Alternative: PM2 (requires Bun in PATH)**
```bash
bun run build
pm2 start ecosystem.config.cjs
```
