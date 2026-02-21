
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Project, FileChangeType, FileChange } from '../types';
import { Icons } from '../constants';
import { generateCommitMessage } from '../services/geminiService';

interface FileItemProps {
  change: FileChange;
  onStage?: () => void;
  onUnstage?: () => void;
}

const FileItem: React.FC<FileItemProps> = ({ change, onStage, onUnstage }) => {
  const getTheme = () => {
    switch (change.type) {
      case FileChangeType.ADDED: return { text: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-500/20', icon: 'A' };
      case FileChangeType.MODIFIED: return { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-500/20', icon: 'M' };
      case FileChangeType.DELETED: return { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-500/20', icon: 'D' };
      default: return { text: 'text-slate-400', bg: 'bg-slate-400/5', border: 'border-slate-400/10', icon: '?' };
    }
  };
  const theme = getTheme();
  return (
    <div className="flex items-center justify-between py-1.5 px-3 hover:bg-slate-800/60 transition-all group rounded border border-transparent hover:border-slate-800 mb-1">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-4 h-4 rounded-sm flex items-center justify-center text-[10px] font-black mono border shadow-sm ${theme.border} ${theme.bg} ${theme.text}`}>{theme.icon}</div>
        <div className="flex flex-col min-w-0">
           <span className="mono text-sm text-slate-200 truncate group-hover:text-white leading-none mb-0.5">{change.path.split('/').pop()}</span>
           <span className="mono text-xs text-slate-600 truncate opacity-60 leading-none">{change.path}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {change.staged ? (
          <button
            onClick={onUnstage}
            className="text-[9px] font-black text-emerald-500/80 bg-emerald-500/5 px-1.5 py-0.5 border border-emerald-500/20 rounded-sm tracking-tighter shadow-sm shadow-emerald-500/5 hover:bg-emerald-500/10 transition-all"
          >
            STAGED
          </button>
        ) : (
          <button
            onClick={onStage}
            className="text-[9px] font-black text-slate-500 bg-slate-500/5 px-1.5 py-0.5 border border-slate-500/20 rounded-sm tracking-tighter opacity-0 group-hover:opacity-100 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
          >
            STAGE
          </button>
        )}
      </div>
    </div>
  );
};

interface ProjectDetailsProps {
  project: Project;
  onCommit: (projectId: string, message: string) => void;
  onRefresh: (projectId: string) => void;
  onBranchSwitch: (projectId: string, branch: string) => void;
  onStageFile: (projectId: string, filePath: string) => void;
  onUnstageFile: (projectId: string, filePath: string) => void;
  onStageAll: (projectId: string) => void;
  onCreateBranch: (projectId: string, branchName: string) => void;
  onCommitAll: (projectId: string, message: string) => void;
  isCommitting?: boolean;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ 
  project, 
  onCommit, 
  onRefresh, 
  onBranchSwitch,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onCreateBranch,
  onCommitAll,
  isCommitting = false
}) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [commitPanelHeight, setCommitPanelHeight] = useState(90);
  const [isResizing, setIsResizing] = useState(false);
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = containerRect.bottom - e.clientY;
      setCommitPanelHeight(Math.max(86, Math.min(containerRect.height * 0.7, newHeight)));
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Strict sorting: main/master -> develop/dev -> others
  const sortedBranches = useMemo(() => {
    const branches = [...project.branches];
    
    const prioritySort = (a: string, b: string) => {
      const aL = a.toLowerCase();
      const bL = b.toLowerCase();
      
      const getP = (n: string) => {
        if (n === 'main' || n === 'master') return 0;
        if (n === 'develop' || n === 'dev') return 1;
        return 2;
      };

      const pA = getP(aL);
      const pB = getP(bL);

      if (pA !== pB) return pA - pB;
      return a.localeCompare(b);
    };

    return branches.sort(prioritySort);
  }, [project.branches]);

  const { stagedChanges, unstagedChanges } = useMemo(() => ({
    stagedChanges: project.changes.filter(c => c.staged),
    unstagedChanges: project.changes.filter(c => !c.staged)
  }), [project.changes]);

  const handleAISuggest = async () => {
    if (project.changes.length === 0) return;
    setIsGenerating(true);
    setCommitMessage(await generateCommitMessage(project.changes));
    setIsGenerating(false);
  };

  const handleCreateBranchSubmit = () => {
    if (!newBranchName.trim()) return;
    onCreateBranch(project.id, newBranchName.trim());
    setNewBranchName('');
    setShowCreateBranch(false);
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden p-1 gap-1">
      {/* Detail Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/40 border border-slate-800/40 rounded-t-lg flex-shrink-0 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0 overflow-hidden">
          <h2 className="text-sm font-black text-white uppercase tracking-wider truncate flex-shrink-0">{project.name}</h2>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-fade-right">
            {sortedBranches.map(b => (
              <button 
                key={b} 
                onClick={() => onBranchSwitch(project.id, b)} 
                className={`px-2 py-0.5 rounded border text-xs mono font-bold transition-all whitespace-nowrap ${
                  b === project.branch 
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]' 
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-600 hover:text-slate-400 hover:border-slate-700'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button 
            onClick={() => setShowCreateBranch(true)} 
            className="p-1 rounded text-blue-500/80 hover:text-blue-400 transition-colors"
            title="Create new branch"
          >
            <span className="text-sm font-bold">+</span>
          </button>
          <button onClick={() => onRefresh(project.id)} className="p-1.5 rounded text-slate-600 hover:text-slate-300 transition-colors"><Icons.Refresh className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* File List Area */}
      <div className="flex-grow flex flex-col min-h-0 bg-slate-900/20 border border-slate-800/40 overflow-hidden shadow-inner">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/30 bg-slate-900/40">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Staged & Unstaged Changes</span>
          <span className="mono text-[10px] text-slate-700 font-bold">{project.changes.length} files</span>
        </div>
        <div className="overflow-y-auto flex-grow p-2 custom-scrollbar">
          {project.changes.length > 0 ? (
            <div className="flex flex-col">
              {stagedChanges.length > 0 && (
                <div className="mb-4">
                   <div className="text-[9px] font-black uppercase text-emerald-500/50 tracking-widest mb-1.5 ml-1">Staged</div>
                   {stagedChanges.map((c, i) => (
                     <FileItem 
                       key={`s-${i}`} 
                       change={c} 
                       onUnstage={() => onUnstageFile(project.id, c.path)}
                     />
                   ))}
                </div>
              )}
              {unstagedChanges.length > 0 && (
                <div>
                   <div className="text-[9px] font-black uppercase text-amber-500/50 tracking-widest mb-1.5 ml-1">Unstaged</div>
                   {unstagedChanges.map((c, i) => (
                     <FileItem 
                       key={`u-${i}`} 
                       change={c} 
                       onStage={() => onStageFile(project.id, c.path)}
                     />
                   ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-800 opacity-20">
              <Icons.Check className="w-8 h-8 mb-2" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Workspace Clean</span>
            </div>
          )}
        </div>
      </div>

      {/* Vertical Resizer */}
      <div onMouseDown={startResizing} className="h-[3px] w-full bg-slate-800/40 hover:bg-blue-500/40 cursor-row-resize z-10 transition-colors" />

      {/* Commit Panel */}
      <div style={{ height: `${commitPanelHeight}px` }} className="flex-shrink-0 bg-slate-900/30 border border-slate-800/40 rounded-b-lg p-2 flex flex-col gap-2 overflow-hidden backdrop-blur-sm">
        <div className="flex justify-between items-center px-0.5">
          <span className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em]">Commit Message</span>
          <button onClick={handleAISuggest} disabled={isGenerating || project.changes.length === 0} className="flex items-center gap-1.5 text-[10px] font-black text-blue-500/80 uppercase hover:text-blue-400 disabled:opacity-20 transition-all">
            <Icons.Sparkles className={`w-2.5 h-2.5 ${isGenerating ? 'animate-spin' : ''}`} /> {isGenerating ? 'ANALYZING...' : 'AI SUGGEST'}
          </button>
        </div>
        <textarea 
          value={commitMessage} 
          onChange={(e) => setCommitMessage(e.target.value)} 
          placeholder="What's changed in this commit?..." 
          className="w-full flex-grow bg-slate-950/60 border border-slate-800/60 rounded p-2 text-sm text-slate-300 outline-none focus:ring-1 focus:ring-blue-500/30 resize-none mono leading-relaxed placeholder-slate-800" 
        />
        <div className="flex gap-1.5">
          <button 
            onClick={() => { onCommit(project.id, commitMessage); setCommitMessage(''); }} 
            disabled={!commitMessage.trim() || isCommitting || stagedChanges.length === 0} 
            className="flex-grow bg-blue-600/90 hover:bg-blue-600 disabled:bg-slate-800/50 text-white text-xs font-black uppercase tracking-widest py-2 rounded shadow-lg shadow-blue-500/5 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isCommitting ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Committing...
              </>
            ) : (
              <>Commit to {project.branch}</>
            )}
          </button>
          <button 
            onClick={() => { onCommitAll(project.id, commitMessage); setCommitMessage(''); }} 
            disabled={!commitMessage.trim() || isCommitting || project.changes.length === 0} 
            className="bg-emerald-600/90 hover:bg-emerald-600 disabled:bg-slate-800/50 text-white text-xs font-black uppercase tracking-wider px-3 py-2 rounded shadow-lg shadow-emerald-500/5 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 whitespace-nowrap"
            title="Stage all files and commit (like git commit -a)"
          >
            {isCommitting ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>+ Commit All</>
            )}
          </button>
          <button 
            onClick={() => onStageAll(project.id)}
            disabled={unstagedChanges.length === 0}
            className="bg-slate-800/60 hover:bg-slate-800 text-slate-500 hover:text-slate-300 disabled:opacity-30 text-xs font-black uppercase px-3 py-2 rounded border border-slate-700/20 transition-all active:scale-[0.98]"
          >
            + Stage All
          </button>
        </div>
      </div>

      {/* Create Branch Modal */}
      {showCreateBranch && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xs rounded-xl p-3 flex flex-col gap-2 shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Create New Branch</h3>
            <input 
              autoFocus 
              value={newBranchName} 
              onChange={(e) => setNewBranchName(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleCreateBranchSubmit()} 
              placeholder="Branch name..." 
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500/30" 
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowCreateBranch(false); setNewBranchName(''); }} className="text-[9px] text-slate-500 font-bold uppercase px-2">Cancel</button>
              <button onClick={handleCreateBranchSubmit} className="bg-blue-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
