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

### Terminal 1 - Backend API Server (port 3007)
```bash
npm run dev:server
# or
bun run dev:server
```

### Terminal 2 - Frontend Dev Server
```bash
npm run dev
# or
bun run dev
```

The application will be available at `http://localhost:5173` (Vite default port)

## Build for Production

```bash
npm run build
npm run preview
```
