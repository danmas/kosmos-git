
import React, { useState, useEffect, useCallback } from 'react';
import { Project, GitStatus, AppState, AppSettings } from './types';
import { ProjectTab } from './components/ProjectTab';
import { ProjectDetails } from './components/ProjectDetails';
import { Icons } from './constants';
import { parseProjectInput } from './services/geminiService';
import * as api from './services/apiService';

const SETTINGS_KEY = 'gitlens_settings_v1';

const App: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const [state, setState] = useState<AppState>({
    projects: [],
    activeProjectId: '',
    settings: { pollInterval: 60, projects: [] },
    showSettings: false,
    showAIAdd: false
  });

  const [settingsJson, setSettingsJson] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Load projects from API on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        console.log('Loading projects from API...');
        const data = await api.fetchProjects();
        console.log('Projects loaded:', data);
        setState(prev => ({
          ...prev,
          projects: data.projects,
          activeProjectId: data.projects[0]?.id || '',
          settings: { ...prev.settings, pollInterval: data.pollInterval }
        }));
        setSettingsJson(JSON.stringify({ pollInterval: data.pollInterval, projects: data.projects.map(p => ({ id: p.id, name: p.name, path: p.path })) }, null, 2));
      } catch (error) {
        console.error('Failed to load projects from API:', error);
      }
    };
    loadProjects();
  }, []);

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

  // Polling - refresh projects from API
  useEffect(() => {
    if (state.projects.length === 0) return;
    
    const intervalId = setInterval(async () => {
      try {
        const projectIds = state.projects.map(p => p.id);
        const updatedProjects = await api.refreshAllProjects(projectIds);
        setState(prev => ({ ...prev, projects: updatedProjects }));
      } catch (error) {
        console.error('Failed to refresh projects:', error);
      }
    }, state.settings.pollInterval * 1000);
    
    return () => clearInterval(intervalId);
  }, [state.settings.pollInterval, state.projects.length]);

  const activeProject = state.projects.find(p => p.id === state.activeProjectId);

  const handleProjectClick = (id: string) => {
    setState(prev => ({ ...prev, activeProjectId: id }));
  };

  const handleCommit = async (projectId: string, message: string) => {
    try {
      const updatedProject = await api.commitChanges(projectId, message);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (error) {
      console.error('Commit failed:', error);
      alert('Failed to commit changes');
    }
  };

  const handleBranchSwitch = async (projectId: string, branch: string) => {
    try {
      const updatedProject = await api.checkoutBranch(projectId, branch);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (error) {
      console.error('Branch switch failed:', error);
      alert('Failed to switch branch');
    }
  };

  const handleRefresh = async (projectId: string) => {
    try {
      const updatedProject = await api.refreshProject(projectId);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  const handleStageFile = async (projectId: string, filePath: string) => {
    try {
      const updatedProject = await api.stageFiles(projectId, [filePath]);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (error) {
      console.error('Stage failed:', error);
      alert('Failed to stage file');
    }
  };

  const handleUnstageFile = async (projectId: string, filePath: string) => {
    try {
      const updatedProject = await api.unstageFiles(projectId, [filePath]);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (error) {
      console.error('Unstage failed:', error);
      alert('Failed to unstage file');
    }
  };

  const handleStageAll = async (projectId: string) => {
    try {
      const updatedProject = await api.stageAllFiles(projectId);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (error) {
      console.error('Stage all failed:', error);
      alert('Failed to stage all files');
    }
  };

  const handleCreateBranch = async (projectId: string, branchName: string) => {
    try {
      const updatedProject = await api.createBranch(projectId, branchName);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (error) {
      console.error('Create branch failed:', error);
      alert('Failed to create branch');
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Auto-fix Windows paths: escape backslashes properly for JSON
      // Replace \ with / for paths (simpler and works everywhere)
      let fixedJson = settingsJson;
      
      // Fix unescaped backslashes in paths by replacing them with forward slashes
      fixedJson = fixedJson.replace(/"([^"]*?)\\([^"\\nrt\"])/g, (match, before, after) => {
        // Keep replacing until no more single backslashes
        let result = `"${before}/${after}`;
        return result;
      });
      
      // Multiple passes to catch all backslashes
      for (let i = 0; i < 10; i++) {
        fixedJson = fixedJson.replace(/("[^"]*?)\\([^"\\nrt])/g, '$1/$2');
      }
      
      // Validate JSON first
      const parsed = JSON.parse(fixedJson);
      
      // Validate structure
      if (!parsed.pollInterval || !Array.isArray(parsed.projects)) {
        alert('Invalid config structure. Required: { pollInterval: number, projects: [...] }');
        return;
      }
      
      // Validate paths (Windows backslashes must be escaped)
      for (const project of parsed.projects) {
        if (!project.id || !project.name || !project.path) {
          alert('Each project must have: id, name, path');
          return;
        }
      }
      
      // Save to server
      const data = await api.saveConfig(parsed);
      
      // Update local state with projects from server
      setState(prev => ({
        ...prev,
        projects: data.projects,
        settings: { pollInterval: data.pollInterval, projects: data.projects.map(p => ({ id: p.id, name: p.name, path: p.path })) },
        showSettings: false
      }));
      
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ pollInterval: data.pollInterval, projects: data.projects.map(p => ({ id: p.id, name: p.name, path: p.path })) }));
    } catch (e) {
      console.error('Failed to save config:', e);
      if (e instanceof SyntaxError) {
        alert(`JSON syntax error: ${e.message}\n\nTip: Use forward slashes (/) or double backslashes (\\\\) in paths.`);
      } else {
        alert("Failed to save configuration. Check console for details.");
      }
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
            <h1 className="text-[12px] font-black tracking-widest text-white uppercase truncate">GitLens</h1>
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
            onRefresh={handleRefresh}
            onBranchSwitch={handleBranchSwitch}
            onStageFile={handleStageFile}
            onUnstageFile={handleUnstageFile}
            onStageAll={handleStageAll}
            onCreateBranch={handleCreateBranch}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-800 opacity-20">
            <Icons.Folder className="w-10 h-10 mb-2" />
            <p className="text-[11px] font-black uppercase tracking-widest">Select Folder</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {state.showAIAdd && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-xl p-4 flex flex-col gap-3 shadow-2xl">
             <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-400">AI Add Project</h3>
             <input autoFocus value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAIAddProject()} placeholder="Describe folder path..." className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500/30" />
             <div className="flex justify-end gap-2">
                <button onClick={() => setState(prev => ({ ...prev, showAIAdd: false }))} className="text-[11px] text-slate-500 font-bold uppercase px-3">Cancel</button>
                <button onClick={handleAIAddProject} className="bg-blue-600 text-white text-[11px] font-black uppercase px-4 py-1.5 rounded">{isAiProcessing ? "..." : "Add"}</button>
             </div>
          </div>
        </div>
      )}

      {state.showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl h-[60vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">
            <div className="px-2 py-1 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">config.json</h3>
              <button onClick={() => setState(prev => ({ ...prev, showSettings: false }))} className="text-slate-600 hover:text-white text-[12px]">✕</button>
            </div>
            <textarea value={settingsJson} onChange={(e) => setSettingsJson(e.target.value)} className="flex-grow bg-slate-950 p-2 mono text-[12px] text-slate-300 resize-none outline-none" spellCheck={false} />
            <div className="p-[2px] border-t border-slate-800 flex justify-end gap-1 bg-slate-900/50">
              <button onClick={() => setState(prev => ({ ...prev, showSettings: false }))} className="px-2 py-1 text-[10px] font-black uppercase text-slate-500">Cancel</button>
              <button onClick={handleSaveSettings} className="bg-blue-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
