
import { GitStatus, FileChangeType, Project } from '../types';

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'frontend-core',
    path: '~/projects/frontend-core',
    branch: 'main',
    branches: ['main', 'develop', 'feat/auth', 'fix/ui-glitch'],
    status: GitStatus.CLEAN,
    changes: [],
    lastCommitMessage: 'feat: add authentication layer',
    lastCommitDate: '2 hours ago'
  },
  {
    id: 'p2',
    name: 'backend-api',
    path: '~/projects/backend-api',
    branch: 'develop',
    branches: ['develop', 'main', 'feature/api-v2', 'hotfix/db-leak'],
    status: GitStatus.DIRTY,
    changes: [
      { path: 'src/controllers/userController.ts', type: FileChangeType.MODIFIED, staged: true },
      { path: 'src/models/User.ts', type: FileChangeType.MODIFIED, staged: true },
      { path: 'src/services/authService.ts', type: FileChangeType.MODIFIED, staged: false },
      { path: 'tests/api.spec.ts', type: FileChangeType.ADDED, staged: false },
      { path: 'package.json', type: FileChangeType.MODIFIED, staged: false },
      { path: 'README.md', type: FileChangeType.MODIFIED, staged: false }
    ],
    lastCommitMessage: 'fix: resolving race condition in db calls',
    lastCommitDate: '1 day ago'
  },
  {
    id: 'p3',
    name: 'shared-ui-lib',
    path: '~/work/ui-lib',
    branch: 'feature/dark-mode',
    branches: ['feature/dark-mode', 'main', 'beta'],
    status: GitStatus.DIRTY,
    changes: [
      { path: 'components/Button.tsx', type: FileChangeType.MODIFIED, staged: true },
      { path: 'styles/theme.css', type: FileChangeType.DELETED, staged: false }
    ],
    lastCommitMessage: 'chore: initial theme setup',
    lastCommitDate: '3 days ago'
  },
  {
    id: 'p4',
    name: 'documentation-site',
    path: '~/projects/docs',
    branch: 'main',
    branches: ['main', 'gh-pages', 'v2-docs'],
    status: GitStatus.AHEAD,
    changes: [],
    lastCommitMessage: 'docs: update deployment instructions',
    lastCommitDate: '4 hours ago'
  }
];
