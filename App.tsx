
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Project, GitStatus, AppState, AppSettings } from './types';
import { INITIAL_PROJECTS } from './services/mockData';
import { ProjectTab } from './components/ProjectTab';
import { ProjectDetails } from './components/ProjectDetails';
import { Icons } from './constants';
import { parseProjectInput } from './services/geminiService';

const SETTINGS_KEY = 'gitlens_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  pollInterval: 60,
  projects: INITIAL_PROJECTS.map(p => ({ id: p.id, name: p.name, path: p.path }))
};

const App: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    const settings = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    return {
      projects: INITIAL_PROJECTS,
      activeProjectId: INITIAL_PROJECTS[0].id,
      settings,
      showSettings: false,
      showAIAdd: false
    };
  });

  const [settingsJson, setSettingsJson] = useState(JSON.stringify(state.settings, null, 2));
  const [aiInput, setAiInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Resize Handlers
  const startResizingSidebar = useCallback(() => {
    setIsResizingSidebar(true);
  }, []);

  const stopResizingSidebar = useCallback(() => {
    setIsResizingSidebar(false);
  }, []);

  const resizeSidebar = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = Math.max(160, Math.min(450, e.clientX));
      setSidebarWidth(newWidth);
    }
  }, [isResizingSidebar]);

  useEffect(() => {
    if (isResizingSidebar) {
      window.addEventListener('mousemove', resizeSidebar);
      window.addEventListener('mouseup', stopResizingSidebar);
    } else {
      window.removeEventListener('mousemove', resizeSidebar);
      window.removeEventListener('mouseup', stopResizingSidebar);
    }
    return () => {
      window.removeEventListener('mousemove', resizeSidebar);
      window.removeEventListener('mouseup', stopResizingSidebar);
    };
  }, [isResizingSidebar, resizeSidebar, stopResizingSidebar]);

  // Sync projects with settings
  useEffect(() => {
    setState(prev => {
      const newProjects = prev.settings.projects.map(sp => {
        const existing = prev.projects.find(p => p.id === sp.id);
        if (existing) {
          return { ...existing, name: sp.name, path: sp.path };
        }
        return {
          id: sp.id,
          name: sp.name,
          path: sp.path,
          branch: 'main',
          branches: ['main', 'develop'],
          status: GitStatus.CLEAN,
          changes: []
        };
      });
      return { ...prev, projects: newProjects };
    });
  }, [state.settings]);

  // Status polling
  useEffect(() => {
    const intervalId = setInterval(() => {
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => {
          if (p.status === GitStatus.CLEAN && Math.random() > 0.9) {
            return { ...p, status: GitStatus.DIRTY };
          }
          return p;
        })
      }));
    }, state.settings.pollInterval * 1000);

    return () => clearInterval(intervalId);
  }, [state.settings.pollInterval]);

  const activeProject = state.projects.find(p => p.id === state.activeProjectId);

  const handleProjectClick = (id: string) => {
    setState(prev => ({ ...prev, activeProjectId: id }));
  };

  const handleCommit = (projectId: string, message: string) => {
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

  const handleBranchSwitch = (projectId: string, branch: string) => {
    setState(prev => ({
      ...prev,
      projects: prev.projects.map(p => p.id === projectId ? { ...p, branch } : p)
    }));
  };

  const handleSaveSettings = () => {
    try {
      const parsed = JSON.parse(settingsJson);
      setState(prev => ({ ...prev, settings: parsed, showSettings: false }));
      localStorage.setItem(SETTINGS_KEY, settingsJson);
    } catch (e) {
      alert("Invalid JSON configuration.");
    }
  };

  const handleAIAddProject = async () => {
    if (!aiInput.trim()) return;
    setIsAiProcessing(true);
    const parsed = await parseProjectInput(aiInput);
    if (parsed) {
      const newProjectSettings = {
        id: `p-${Date.now()}`,
        name: parsed.name,
        path: parsed.path
      };
      const updatedSettings = {
        ...state.settings,
        projects: [...state.settings.projects, newProjectSettings]
      };
      setState(prev => ({ 
        ...prev, 
        settings: updatedSettings, 
        showAIAdd: false,
        activeProjectId: newProjectSettings.id
      }));
      setSettingsJson(JSON.stringify(updatedSettings, null, 2));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
      setAiInput('');
    } else {
      alert("Could not parse project info. Try being more specific with path and name.");
    }
    setIsAiProcessing(false);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden select-none relative">
      <aside 
        style={{ width: `${sidebarWidth}px` }}
        className="border-r border-slate-800/40 bg-slate-900/20 p-[2px] flex flex-col backdrop-blur-md relative"
      >
        <div className="flex items-center justify-between py-1.5 px-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded bg-blue-600 flex-shrink-0 flex items-center justify-center">
              <Icons.GitBranch className="text-white w-3 h-3" />
            </div>
            <h1 className="text-xs font-black tracking-widest text-white uppercase truncate">GitLens</h1>
          </div>
          <div className="flex gap-[2px] flex-shrink-0">
            <button 
              onClick={() => setState(prev => ({ ...prev, showAIAdd: true }))}
              title="AI Project Add"
              className="p-1 rounded hover:bg-slate-800 transition-colors text-blue-500/80 hover:text-blue-400"
            >
              <Icons.Sparkles className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setState(prev => ({ ...prev, showSettings: true }))}
              className="p-1 rounded hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-300"
            >
              <Icons.Settings className="w-3.5 h-3.5" />
            </button>
            <button 
              className="p-1 rounded hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-300"
            >
              <Icons.Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <nav className="flex-grow overflow-y-auto pr-[1px] custom-scrollbar">
          <div className="px-2 py-1 mb-1">
            <h2 className="text-[8px] font-black uppercase text-slate-600 tracking-[0.2em]">Folders</h2>
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

        <div className="mt-auto p-1 bg-slate-900/50 border-t border-slate-800/40">
          <div className="flex items-center gap-2 p-1.5 rounded bg-slate-800/20 border border-slate-800/30">
            <div className="w-5 h-5 rounded-full bg-slate-700 flex-shrink-0"></div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[9px] font-bold text-slate-400 truncate leading-none">Developer Mode</span>
              <span className="text-[7px] text-emerald-500 flex items-center gap-1 mt-0.5">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                Polling {state.settings.pollInterval}s
              </span>
            </div>
          </div>
        </div>

        {/* Vertical Divider (Sidebar width resizer) */}
        <div 
          onMouseDown={startResizingSidebar}
          className="absolute right-[-1px] top-0 bottom-0 w-[3px] bg-transparent hover:bg-blue-500/30 cursor-col-resize z-20 transition-colors"
        />
      </aside>

      <main className="flex-grow flex flex-col p-[2px] overflow-hidden bg-slate-950/50">
        {activeProject ? (
          <ProjectDetails 
            project={activeProject} 
            onCommit={handleCommit}
            onRefresh={() => {}}
            onBranchSwitch={handleBranchSwitch}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-800 opacity-20">
            <Icons.Folder className="w-12 h-12 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">Workspace Empty</p>
          </div>
        )}
      </main>

      {/* AI Add Modal */}
      {state.showAIAdd && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in zoom-in-95 duration-150">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden p-4 flex flex-col gap-3">
             <div className="flex items-center justify-between">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                 <Icons.Sparkles className="w-3.5 h-3.5 text-blue-500" />
                 AI Quick Add
               </h3>
               <button onClick={() => setState(prev => ({ ...prev, showAIAdd: false }))} className="text-slate-600 hover:text-white">✕</button>
             </div>
             <p className="text-[10px] text-slate-500 italic">Example: "Add my dashboard project located at ~/dev/dashboard"</p>
             <input 
               autoFocus
               value={aiInput}
               onChange={(e) => setAiInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleAIAddProject()}
               placeholder="Describe project or paste path..."
               className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
             />
             <div className="flex justify-end gap-2">
                <button 
                  disabled={isAiProcessing}
                  onClick={handleAIAddProject}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded transition-all shadow-lg shadow-blue-500/10"
                >
                  {isAiProcessing ? "Analyzing..." : "Add to Workspace"}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {state.showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl h-[70vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                <Icons.Settings className="w-3.5 h-3.5 text-blue-500" />
                Settings.json
              </h3>
              <button onClick={() => setState(prev => ({ ...prev, showSettings: false }))} className="text-slate-600 hover:text-white p-1">✕</button>
            </div>
            <div className="flex-grow p-4 flex flex-col min-h-0">
              <textarea 
                value={settingsJson}
                onChange={(e) => setSettingsJson(e.target.value)}
                className="flex-grow w-full bg-slate-950 border border-slate-800 rounded-lg p-3 mono text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-none custom-scrollbar"
                spellCheck={false}
              />
            </div>
            <div className="p-3 border-t border-slate-800 flex justify-end gap-2 bg-slate-900/50">
              <button onClick={() => setState(prev => ({ ...prev, showSettings: false }))} className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white">Cancel</button>
              <button onClick={handleSaveSettings} className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded shadow-lg shadow-blue-500/10">Save Config</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;