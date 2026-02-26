
import React, { useState, useEffect, useCallback } from 'react';
import { Project, GitStatus, AppState, AppSettings } from './types';
import { ProjectTab } from './components/ProjectTab';
import { ProjectDetails } from './components/ProjectDetails';
import { Icons } from './constants';
import { parseProjectInput } from './services/geminiService';
import {
  fetchProjects,
  fetchProjectStatus,
  commitChanges as apiCommitChanges,
  commitAllChanges as apiCommitAllChanges,
  checkoutBranch as apiCheckoutBranch,
  stageFiles as apiStageFiles,
  unstageFiles as apiUnstageFiles,
  stageAllFiles as apiStageAllFiles,
  unstageAllFiles as apiUnstageAllFiles,
  createBranch as apiCreateBranch,
  mergeDevToMain as apiMergeDevToMain,
  mergeBranches as apiMergeBranches,
  saveConfig,
  getConfig
} from './services/apiService';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const SETTINGS_KEY = 'gitlens_settings_v1';

const App: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<AppState>({
    projects: [],
    activeProjectId: null,
    settings: { pollInterval: 60, projects: [] },
    showSettings: false,
    showAIAdd: false
  });

  const [settingsJson, setSettingsJson] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  // Load projects from API on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [{ projects, pollInterval }, config] = await Promise.all([
          fetchProjects(),
          getConfig()
        ]);
        setState(prev => ({
          ...prev,
          projects,
          activeProjectId: projects[0]?.id || null,
          settings: config
        }));
        setSettingsJson(JSON.stringify(config, null, 2));
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError('Failed to connect to server. Make sure backend is running.');
      } finally {
        setIsLoading(false);
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

  // Polling - refresh all projects periodically
  useEffect(() => {
    if (state.projects.length === 0) return;

    const intervalId = setInterval(async () => {
      try {
        const updatedProjects = await Promise.all(
          state.projects.map(p => fetchProjectStatus(p.id).catch(() => p))
        );
        setState(prev => ({ ...prev, projects: updatedProjects }));
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, state.settings.pollInterval * 1000);

    return () => clearInterval(intervalId);
  }, [state.projects.length, state.settings.pollInterval]);

  const activeProject = state.projects.find(p => p.id === state.activeProjectId);

  const handleProjectClick = (id: string) => {
    setState(prev => ({ ...prev, activeProjectId: id }));
  };

  const handleCommit = async (projectId: string, message: string) => {
    try {
      setIsCommitting(true);
      const updatedProject = await apiCommitChanges(projectId, message);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
      showToast('success', `Commit successful: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
    } catch (err: any) {
      console.error('Commit error:', err);
      const errorMessage = err?.message || 'Failed to commit changes';
      showToast('error', errorMessage);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCommitAll = async (projectId: string, message: string) => {
    try {
      setIsCommitting(true);
      const updatedProject = await apiCommitAllChanges(projectId, message);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
      showToast('success', `All changes committed: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
    } catch (err: any) {
      console.error('Commit all error:', err);
      const errorMessage = err?.message || 'Failed to commit all changes';
      showToast('error', errorMessage);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleBranchSwitch = async (projectId: string, branch: string) => {
    try {
      const updatedProject = await apiCheckoutBranch(projectId, branch);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (err: any) {
      console.error('Checkout error:', err);
      const errorMessage = err?.message || 'Failed to switch branch';
      alert(`Branch switch failed:\n${errorMessage}`);
    }
  };

  const handleRefresh = async (projectId: string) => {
    try {
      const updatedProject = await fetchProjectStatus(projectId);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  const handleStageFile = async (projectId: string, filePath: string) => {
    try {
      const updatedProject = await apiStageFiles(projectId, [filePath]);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (err) {
      console.error('Stage error:', err);
    }
  };

  const handleUnstageFile = async (projectId: string, filePath: string) => {
    try {
      const updatedProject = await apiUnstageFiles(projectId, [filePath]);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (err) {
      console.error('Unstage error:', err);
    }
  };

  const handleStageAll = async (projectId: string) => {
    try {
      const updatedProject = await apiStageAllFiles(projectId);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (err) {
      console.error('Stage all error:', err);
    }
  };

  const handleCreateBranch = async (projectId: string, branchName: string) => {
    try {
      const updatedProject = await apiCreateBranch(projectId, branchName);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
      }));
    } catch (err) {
      console.error('Create branch error:', err);
      alert('Failed to create branch');
    }
  };

  const handleMergeDevToMain = async (projectId: string) => {
    try {
      setIsCommitting(true);
      const result = await apiMergeDevToMain(projectId);

      if (result.success) {
        // Refresh project status after successful merge
        const updatedProject = await fetchProjectStatus(projectId);
        setState(prev => ({
          ...prev,
          projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
        }));
        showToast('success', 'dev->main merge completed successfully');

        // Show detailed report in console
        console.log('Merge Report:\n', result.report);

        // Optional: show report in alert or modal
        alert(`Merge Report:\n\n${result.report}`);
      } else {
        showToast('error', result.error || 'Merge failed');
        // Show detailed report even on failure
        if (result.report) {
          console.log('Merge Report:\n', result.report);
          alert(`Merge Report:\n\n${result.report}\n\nError: ${result.error}`);
        }
      }
    } catch (err: any) {
      console.error('Merge error:', err);
      const errorMessage = err?.message || 'Failed to merge dev->main';
      showToast('error', errorMessage);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleMergeBranches = async (projectId: string, fromBranch: string, toBranch: string) => {
    try {
      setIsCommitting(true);
      const result = await apiMergeBranches(projectId, fromBranch, toBranch);

      if (result.success) {
        // Refresh project status after successful merge
        const updatedProject = await fetchProjectStatus(projectId);
        setState(prev => ({
          ...prev,
          projects: prev.projects.map(p => p.id === projectId ? updatedProject : p)
        }));
        showToast('success', `${fromBranch} -> ${toBranch} merge completed successfully`);

        // Show detailed report in console
        console.log('Merge Report:\n', result.report);
        alert(`Merge Report:\n\n${result.report}`);
      } else {
        showToast('error', result.error || 'Merge failed');
        if (result.report) {
          console.log('Merge Report:\n', result.report);
          alert(`Merge Report:\n\n${result.report}\n\nError: ${result.error}`);
        }
      }
    } catch (err: any) {
      console.error('Merge error:', err);
      const errorMessage = err?.message || 'Failed to merge branches';
      showToast('error', errorMessage);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleOpenSettings = async () => {
    try {
      const config = await getConfig();
      setSettingsJson(JSON.stringify(config, null, 2));
      setState(prev => ({
        ...prev,
        settings: config,
        showSettings: true
      }));
    } catch (err) {
      console.error('Failed to reload settings:', err);
      setState(prev => ({ ...prev, showSettings: true }));
    }
  };

  const handleSaveSettings = async () => {
    try {
      const parsed = JSON.parse(settingsJson);

      // Save to backend via API
      const { projects, pollInterval } = await saveConfig(parsed);

      setState(prev => ({
        ...prev,
        projects,
        settings: { ...parsed, pollInterval },
        showSettings: false,
        activeProjectId: projects[0]?.id || prev.activeProjectId
      }));

      localStorage.setItem(SETTINGS_KEY, settingsJson);
    } catch (e) {
      console.error('Save error:', e);
      alert("Failed to save configuration. Check console for details.");
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
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Loading projects...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && !isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950">
          <div className="text-center max-w-sm">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-rose-500 text-lg">!</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-2">Connection Error</p>
            <p className="text-xs text-slate-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-800 text-white text-[9px] font-black uppercase px-4 py-2 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <aside
        style={{ width: `${sidebarWidth}px` }}
        className="border-r border-slate-800/40 bg-slate-900/30 flex flex-col backdrop-blur-md relative"
      >
        <div className="flex items-center justify-between p-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded bg-blue-600 flex-shrink-0 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <Icons.GitBranch className="text-white w-3 h-3" />
            </div>
            <h1 className="text-sm font-black tracking-widest text-white uppercase truncate">GitLens</h1>
          </div>
          <div className="flex gap-[2px] flex-shrink-0">
            <button onClick={() => setState(prev => ({ ...prev, showAIAdd: true }))} className="p-1 rounded hover:bg-slate-800 text-blue-500/80"><Icons.Sparkles className="w-3.5 h-3.5" /></button>
            <button onClick={handleOpenSettings} className="p-1 rounded hover:bg-slate-800 text-slate-500"><Icons.Settings className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <nav className="flex-grow overflow-y-auto custom-scrollbar px-1">
          <div className="px-1.5 py-1 mb-1">
            <h2 className="text-[9px] font-black uppercase text-slate-600 tracking-[0.2em]">Workspace</h2>
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
          <span className="text-[9px] text-emerald-500 flex items-center gap-1 uppercase font-bold tracking-tighter">
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
            onCommitAll={handleCommitAll}
            onRefresh={handleRefresh}
            onBranchSwitch={handleBranchSwitch}
            onStageFile={handleStageFile}
            onUnstageFile={handleUnstageFile}
            onStageAll={handleStageAll}
            onCreateBranch={handleCreateBranch}
            onMergeDevToMain={handleMergeDevToMain}
            onMergeBranches={handleMergeBranches}
            isCommitting={isCommitting}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-800 opacity-20">
            <Icons.Folder className="w-10 h-10 mb-2" />
            <p className="text-xs font-black uppercase tracking-widest">Select Folder</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {state.showAIAdd && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-xl p-4 flex flex-col gap-3 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-400">AI Add Project</h3>
            <input autoFocus value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAIAddProject()} placeholder="Describe folder path..." className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500/30" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setState(prev => ({ ...prev, showAIAdd: false }))} className="text-xs text-slate-500 font-bold uppercase px-3">Cancel</button>
              <button onClick={handleAIAddProject} className="bg-blue-600 text-white text-xs font-black uppercase px-4 py-1.5 rounded">{isAiProcessing ? "..." : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {state.showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl h-[60vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">
            <div className="px-2 py-0.5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400">config.json</h3>
              <button onClick={() => setState(prev => ({ ...prev, showSettings: false }))} className="text-slate-600 hover:text-white text-[10px]">✕</button>
            </div>
            <textarea value={settingsJson} onChange={(e) => setSettingsJson(e.target.value)} className="flex-grow bg-slate-950 p-2 mono text-[10px] text-slate-300 resize-none outline-none" spellCheck={false} />
            <div className="p-2 border-t border-slate-800 flex justify-end gap-2 bg-slate-900/50">
              <button onClick={() => setState(prev => ({ ...prev, showSettings: false }))} className="px-2 text-[9px] font-black uppercase text-slate-500">Cancel</button>
              <button onClick={handleSaveSettings} className="bg-blue-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-xl backdrop-blur-sm border max-w-sm animate-slide-in ${toast.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              }`}
          >
            <div className="flex items-start gap-2">
              <span className={`text-sm flex-shrink-0 ${toast.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                {toast.type === 'success' ? '✓' : '✕'}
              </span>
              <span className="text-xs font-medium">{toast.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
