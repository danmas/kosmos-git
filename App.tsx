
import React, { useState, useEffect, useCallback } from 'react';
import { Project, GitStatus, AppState, AppSettings } from './types';
import { INITIAL_PROJECTS } from './services/mockData';
import { ProjectTab } from './components/ProjectTab';
import { ProjectDetails } from './components/ProjectDetails';
import { Icons } from './constants';
import { parseProjectInput } from './services/geminiService';

const SETTINGS_KEY = 'gitlens_settings_v1';

const App: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const [state, setState] = useState<AppState>({
    projects: INITIAL_PROJECTS,
    activeProjectId: INITIAL_PROJECTS[0].id,
    settings: { pollInterval: 60, projects: [] },
    showSettings: false,
    showAIAdd: false
  });

  const [settingsJson, setSettingsJson] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Load configuration from config.json on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('./config.json');
        const config: AppSettings = await response.json();
        
        setState(prev => ({
          ...prev,
          settings: config,
          // We'll let the synchronization effect below handle the projects list
        }));
        setSettingsJson(JSON.stringify(config, null, 2));
      } catch (error) {
        console.error("Failed to load config.json, using defaults", error);
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setState(prev => ({ ...prev, settings: parsed }));
          setSettingsJson(saved);
        }
      }
    };
    loadConfig();
  }, []);

  // Synchronize projects state with settings whenever settings change
  useEffect(() => {
    setState(prev => {
      const newProjects = prev.settings.projects.map(sp => {
        const existing = prev.projects.find(p => p.id === sp.id);
        if (existing) {
          // Update names and paths from settings, preserve dynamic git state
          return { ...existing, name: sp.name, path: sp.path };
        }
        // If it's a brand new project added to the JSON manually
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

      // Avoid unnecessary state updates if nothing actually changed
      const hasChanged = JSON.stringify(newProjects) !== JSON.stringify(prev.projects);
      if (!hasChanged) return prev;

      return { ...prev, projects: newProjects };
    });
  }, [state.settings]);

  // Resize Handlers
  const startResizingSidebar = useCallback(() => setIsResizingSidebar(true), []);
  const stopResizingSidebar = useCallback(() => setIsResizingSidebar(false), []);
  const resizeSidebar = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = Math.max(140, Math.min(400, e.clientX));
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

  // Polling Simulation
  useEffect(() => {
    const intervalId = setInterval(() => {
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => {
          if (p.status === GitStatus.CLEAN && Math.random() > 0.95) {
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
      // Updating state.settings will trigger the synchronization useEffect
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
      const newProjectSettings = { id: `p-${Date.now()}`, name: parsed.name, path: parsed.path };
      const updatedSettings = { ...state.settings, projects: [...state.settings.projects, newProjectSettings] };
      setState(prev => ({ 
        ...prev, 
        settings: updatedSettings, 
        showAIAdd: false,
        activeProjectId: newProjectSettings.id
      }));
      setSettingsJson(JSON.stringify(updatedSettings, null, 2));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
      setAiInput('');
    }
    setIsAiProcessing(false);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden select-none relative">
      <aside 
        style={{ width: `${sidebarWidth}px` }}
        className="border-r border-slate-800/40 bg-slate-900/30 flex flex-col backdrop-blur-md relative"
      >
        <div className="flex items-center justify-between p-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded bg-blue-600 flex-shrink-0 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <Icons.GitBranch className="text-white w-3 h-3" />
            </div>
            <h1 className="text-[10px] font-black tracking-widest text-white uppercase truncate">GitLens</h1>
          </div>
          <div className="flex gap-[2px] flex-shrink-0">
            <button onClick={() => setState(prev => ({ ...prev, showAIAdd: true }))} className="p-1 rounded hover:bg-slate-800 text-blue-500/80"><Icons.Sparkles className="w-3.5 h-3.5" /></button>
            <button onClick={() => setState(prev => ({ ...prev, showSettings: true }))} className="p-1 rounded hover:bg-slate-800 text-slate-500"><Icons.Settings className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <nav className="flex-grow overflow-y-auto custom-scrollbar px-1">
          <div className="px-1.5 py-1 mb-1">
            <h2 className="text-[7px] font-black uppercase text-slate-600 tracking-[0.2em]">Workspace</h2>
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

        <div className="mt-auto p-1.5 bg-slate-900/50 border-t border-slate-800/40">
           <span className="text-[7px] text-emerald-500 flex items-center gap-1 uppercase font-bold tracking-tighter">
             <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
             Poll: {state.settings.pollInterval}s
           </span>
        </div>

        <div onMouseDown={startResizingSidebar} className="absolute right-[-1px] top-0 bottom-0 w-[3px] bg-transparent hover:bg-blue-500/40 cursor-col-resize z-20" />
      </aside>

      <main className="flex-grow flex flex-col p-[2px] overflow-hidden">
        {activeProject ? (
          <ProjectDetails 
            project={activeProject} 
            onCommit={handleCommit}
            onRefresh={() => {}}
            onBranchSwitch={handleBranchSwitch}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-800 opacity-20">
            <Icons.Folder className="w-10 h-10 mb-2" />
            <p className="text-[9px] font-black uppercase tracking-widest">Select Folder</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {state.showAIAdd && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-xl p-4 flex flex-col gap-3 shadow-2xl">
             <h3 className="text-[9px] font-black uppercase tracking-widest text-blue-400">AI Add Project</h3>
             <input autoFocus value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAIAddProject()} placeholder="Describe folder path..." className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500/30" />
             <div className="flex justify-end gap-2">
                <button onClick={() => setState(prev => ({ ...prev, showAIAdd: false }))} className="text-[9px] text-slate-500 font-bold uppercase px-3">Cancel</button>
                <button onClick={handleAIAddProject} className="bg-blue-600 text-white text-[9px] font-black uppercase px-4 py-1.5 rounded">{isAiProcessing ? "..." : "Add"}</button>
             </div>
          </div>
        </div>
      )}

      {state.showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl h-[60vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400">config.json</h3>
              <button onClick={() => setState(prev => ({ ...prev, showSettings: false }))} className="text-slate-600 hover:text-white">✕</button>
            </div>
            <textarea value={settingsJson} onChange={(e) => setSettingsJson(e.target.value)} className="flex-grow bg-slate-950 p-4 mono text-[11px] text-slate-300 resize-none outline-none" spellCheck={false} />
            <div className="p-3 border-t border-slate-800 flex justify-end gap-2 bg-slate-900/50">
              <button onClick={() => setState(prev => ({ ...prev, showSettings: false }))} className="px-4 text-[9px] font-black uppercase text-slate-500">Cancel</button>
              <button onClick={handleSaveSettings} className="bg-blue-600 text-white text-[9px] font-black uppercase px-5 py-2 rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
