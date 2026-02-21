
import React, { useState, useEffect } from 'react';
import { Project, GitStatus, AppState } from './types';
import { INITIAL_PROJECTS } from './services/mockData';
import { ProjectTab } from './components/ProjectTab';
import { ProjectDetails } from './components/ProjectDetails';
import { Icons } from './constants';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    projects: INITIAL_PROJECTS,
    activeProjectId: INITIAL_PROJECTS[0].id
  });

  const activeProject = state.projects.find(p => p.id === state.activeProjectId);

  const handleProjectClick = (id: string) => {
    setState(prev => ({ ...prev, activeProjectId: id }));
  };

  const handleCommit = (projectId: string, message: string) => {
    // Simulate commit action
    setState(prev => ({
      ...prev,
      projects: prev.projects.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            status: GitStatus.CLEAN,
            changes: [],
            lastCommitMessage: message,
            lastCommitDate: 'Just now'
          };
        }
        return p;
      })
    }));
  };

  const handleRefresh = (projectId: string) => {
    console.log(`Refreshing ${projectId}...`);
  };

  const handleAddProject = () => {
    alert("Add folder functionality: In a real environment, this would trigger a system directory selection.");
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sidebar / Tabs Navigation - Compacted */}
      <aside className="w-64 border-r border-slate-800/40 bg-slate-900/10 p-2 flex flex-col backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <Icons.GitBranch className="text-white w-3.5 h-3.5" />
            </div>
            <h1 className="text-base font-bold tracking-tight text-white">GitLens</h1>
          </div>
          <button 
            onClick={handleAddProject}
            className="p-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            <Icons.Plus className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        <nav className="flex-grow overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
          <div className="px-2 mb-2">
            <h2 className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Workspace</h2>
          </div>
          {state.projects.map(project => (
            <ProjectTab 
              key={project.id} 
              project={project} 
              isActive={state.activeProjectId === project.id}
              onClick={() => handleProjectClick(project.id)}
            />
          ))}
        </nav>

        <div className="mt-auto pt-2 border-t border-slate-800/40 px-1">
          <div className="flex items-center gap-2 p-2 bg-slate-800/20 rounded-lg border border-slate-800/50">
            <img src="https://picsum.photos/seed/dev/32/32" className="w-6 h-6 rounded-full bg-slate-700" alt="Avatar" />
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] font-semibold text-slate-300 truncate">Developer</span>
              <span className="text-[8px] text-emerald-500 flex items-center gap-1">
                <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                Active
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area - Extremely Compact */}
      <main className="flex-grow flex flex-col relative p-2 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-500/[0.02] blur-[120px] rounded-full"></div>
        
        <div className="flex-grow overflow-hidden z-10 flex flex-col">
          {activeProject ? (
            <ProjectDetails 
              project={activeProject} 
              onCommit={handleCommit}
              onRefresh={handleRefresh}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <Icons.Folder className="w-10 h-10 mb-2 opacity-10" />
              <p className="text-sm font-medium">Select project</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
