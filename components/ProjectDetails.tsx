
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Project, FileChangeType, FileChange } from '../types';
import { Icons } from '../constants';
import { generateCommitMessage } from '../services/geminiService';

interface FileItemProps {
  change: FileChange;
}

const FileItem: React.FC<FileItemProps> = ({ change }) => {
  const getTheme = () => {
    switch (change.type) {
      case FileChangeType.ADDED: return { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-500/20', icon: 'A' };
      case FileChangeType.MODIFIED: return { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-500/20', icon: 'M' };
      case FileChangeType.DELETED: return { text: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-500/20', icon: 'D' };
      default: return { text: 'text-slate-400', bg: 'bg-slate-400/5', border: 'border-slate-400/10', icon: '?' };
    }
  };
  const theme = getTheme();
  return (
    <div className="flex items-center justify-between py-1.5 px-3 hover:bg-slate-800/60 transition-all group rounded border border-transparent hover:border-slate-800 mb-1">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-black mono border shadow-sm ${theme.border} ${theme.bg} ${theme.text}`}>{theme.icon}</div>
        <div className="flex flex-col min-w-0">
           <span className="mono text-[11px] text-slate-200 truncate group-hover:text-white leading-none mb-0.5">{change.path.split('/').pop()}</span>
           <span className="mono text-[8px] text-slate-600 truncate opacity-60 leading-none">{change.path}</span>
        </div>
      </div>
      {change.staged && (
        <span className="text-[7px] font-black text-emerald-500/80 bg-emerald-500/5 px-1.5 py-0.5 border border-emerald-500/20 rounded-sm tracking-tighter shadow-sm shadow-emerald-500/5">STAGED</span>
      )}
    </div>
  );
};

interface ProjectDetailsProps {
  project: Project;
  onCommit: (projectId: string, message: string) => void;
  onRefresh: (projectId: string) => void;
  onBranchSwitch: (projectId: string, branch: string) => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, onCommit, onRefresh, onBranchSwitch }) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [commitPanelHeight, setCommitPanelHeight] = useState(90);
  const [isResizing, setIsResizing] = useState(false);
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

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden p-1 gap-1">
      {/* Detail Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/40 border border-slate-800/40 rounded-t-lg flex-shrink-0 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0 overflow-hidden">
          <h2 className="text-[11px] font-black text-white uppercase tracking-wider truncate flex-shrink-0">{project.name}</h2>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-fade-right">
            {sortedBranches.map(b => (
              <button 
                key={b} 
                onClick={() => onBranchSwitch(project.id, b)} 
                className={`px-2 py-0.5 rounded border text-[9px] mono font-bold transition-all whitespace-nowrap ${
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
        <button onClick={() => onRefresh(project.id)} className="p-1.5 rounded text-slate-600 hover:text-slate-300 transition-colors"><Icons.Refresh className="w-3.5 h-3.5" /></button>
      </div>

      {/* File List Area */}
      <div className="flex-grow flex flex-col min-h-0 bg-slate-900/20 border border-slate-800/40 overflow-hidden shadow-inner">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/30 bg-slate-900/40">
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Staged & Unstaged Changes</span>
          <span className="mono text-[8px] text-slate-700 font-bold">{project.changes.length} files</span>
        </div>
        <div className="overflow-y-auto flex-grow p-2 custom-scrollbar">
          {project.changes.length > 0 ? (
            <div className="flex flex-col">
              {stagedChanges.length > 0 && (
                <div className="mb-4">
                   <div className="text-[7px] font-black uppercase text-emerald-500/50 tracking-widest mb-1.5 ml-1">Staged</div>
                   {stagedChanges.map((c, i) => <FileItem key={`s-${i}`} change={c} />)}
                </div>
              )}
              {unstagedChanges.length > 0 && (
                <div>
                   <div className="text-[7px] font-black uppercase text-amber-500/50 tracking-widest mb-1.5 ml-1">Unstaged</div>
                   {unstagedChanges.map((c, i) => <FileItem key={`u-${i}`} change={c} />)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-800 opacity-20">
              <Icons.Check className="w-8 h-8 mb-2" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Workspace Clean</span>
            </div>
          )}
        </div>
      </div>

      {/* Vertical Resizer */}
      <div onMouseDown={startResizing} className="h-[3px] w-full bg-slate-800/40 hover:bg-blue-500/40 cursor-row-resize z-10 transition-colors" />

      {/* Commit Panel */}
      <div style={{ height: `${commitPanelHeight}px` }} className="flex-shrink-0 bg-slate-900/30 border border-slate-800/40 rounded-b-lg p-2 flex flex-col gap-2 overflow-hidden backdrop-blur-sm">
        <div className="flex justify-between items-center px-0.5">
          <span className="text-[8px] font-black uppercase text-slate-600 tracking-[0.2em]">Commit Message</span>
          <button onClick={handleAISuggest} disabled={isGenerating || project.changes.length === 0} className="flex items-center gap-1.5 text-[8px] font-black text-blue-500/80 uppercase hover:text-blue-400 disabled:opacity-20 transition-all">
            <Icons.Sparkles className={`w-2.5 h-2.5 ${isGenerating ? 'animate-spin' : ''}`} /> {isGenerating ? 'ANALYZING...' : 'AI SUGGEST'}
          </button>
        </div>
        <textarea 
          value={commitMessage} 
          onChange={(e) => setCommitMessage(e.target.value)} 
          placeholder="What's changed in this commit?..." 
          className="w-full flex-grow bg-slate-950/60 border border-slate-800/60 rounded p-2 text-[11px] text-slate-300 outline-none focus:ring-1 focus:ring-blue-500/30 resize-none mono leading-relaxed placeholder-slate-800" 
        />
        <div className="flex gap-1.5">
          <button 
            onClick={() => { onCommit(project.id, commitMessage); setCommitMessage(''); }} 
            disabled={!commitMessage.trim()} 
            className="flex-grow bg-blue-600/90 hover:bg-blue-600 disabled:bg-slate-800/50 text-white text-[9px] font-black uppercase tracking-widest py-2 rounded shadow-lg shadow-blue-500/5 transition-all active:scale-[0.98]"
          >
            Commit to {project.branch}
          </button>
          <button className="bg-slate-800/60 hover:bg-slate-800 text-slate-500 hover:text-slate-300 text-[9px] font-black uppercase px-3 py-2 rounded border border-slate-700/20 transition-all active:scale-[0.98]">+ Stage All</button>
        </div>
      </div>
    </div>
  );
};
