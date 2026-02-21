
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
      case FileChangeType.ADDED: return { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-500/10', icon: 'A' };
      case FileChangeType.MODIFIED: return { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-500/10', icon: 'M' };
      case FileChangeType.DELETED: return { text: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-500/10', icon: 'D' };
      case FileChangeType.RENAMED: return { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-500/10', icon: 'R' };
      default: return { text: 'text-slate-500', bg: 'bg-slate-500/5', border: 'border-slate-500/5', icon: '?' };
    }
  };

  const theme = getTheme();

  return (
    <div className="flex items-center justify-between py-1 px-2 hover:bg-slate-800/40 transition-all group rounded-sm border border-transparent hover:border-slate-700/20 mb-[1px]">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-black mono border ${theme.border} ${theme.bg} ${theme.text}`}>
          {theme.icon}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="mono text-[11px] text-slate-300 truncate group-hover:text-white">
            {change.path.split('/').pop()}
          </span>
          <span className="text-[9px] text-slate-700 truncate mono opacity-40 hidden md:block">
            {change.path}
          </span>
        </div>
      </div>
      {change.staged && (
        <span className="text-[7px] font-black uppercase tracking-tighter text-emerald-500/40 px-1 border border-emerald-500/10 rounded-sm">STAGED</span>
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
  const [commitPanelHeight, setCommitPanelHeight] = useState(120);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resize Handlers
  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = containerRect.bottom - e.clientY;
      // Constraint to avoid too small or too large
      setCommitPanelHeight(Math.max(90, Math.min(containerRect.height * 0.7, newHeight)));
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

  // Ensure current branch is first in the list
  const sortedBranches = useMemo(() => {
    const others = project.branches.filter(b => b !== project.branch);
    return [project.branch, ...others];
  }, [project.branch, project.branches]);

  const { stagedChanges, unstagedChanges } = useMemo(() => {
    return {
      stagedChanges: project.changes.filter(c => c.staged),
      unstagedChanges: project.changes.filter(c => !c.staged)
    };
  }, [project.changes]);

  const handleAISuggest = async () => {
    if (project.changes.length === 0) return;
    setIsGenerating(true);
    const msg = await generateCommitMessage(project.changes);
    setCommitMessage(msg);
    setIsGenerating(false);
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full max-h-full overflow-hidden p-[2px] gap-[2px]">
      {/* Mini Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-slate-900/40 border border-slate-800/40 rounded-t-lg flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 overflow-hidden">
          <h2 className="text-xs font-black text-white uppercase tracking-wider truncate flex-shrink-0">{project.name}</h2>
          
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-fade-right">
            {sortedBranches.map(b => (
              <button
                key={b}
                onClick={() => onBranchSwitch(project.id, b)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] mono font-bold transition-all whitespace-nowrap ${
                  b === project.branch 
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.15)]' 
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-600 hover:text-slate-400 hover:border-slate-600'
                }`}
              >
                <Icons.GitBranch className={`w-2 h-2 ${b === project.branch ? 'opacity-100' : 'opacity-40'}`} />
                {b}
              </button>
            ))}
          </div>
        </div>
        <button 
          onClick={() => onRefresh(project.id)}
          className="p-1 rounded hover:bg-slate-800 transition-colors text-slate-600 hover:text-slate-300 ml-2"
        >
          <Icons.Refresh className="w-3 h-3" />
        </button>
      </div>

      {/* Vertical Stack: Files Above, Commit Below */}
      <div className="flex flex-col flex-grow min-h-0 gap-0">
        
        {/* FILE LIST PANEL (ABOVE) */}
        <div className="flex-grow flex flex-col min-h-0 bg-slate-900/20 border border-slate-800/40 overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800/30 bg-slate-900/40">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">Status</h3>
            <div className="flex gap-2">
              <span className="text-[9px] text-slate-600 font-bold mono">Files: {project.changes.length}</span>
            </div>
          </div>

          <div className="overflow-y-auto flex-grow p-1 custom-scrollbar">
            {project.changes.length > 0 ? (
              <div className="space-y-1">
                {stagedChanges.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center px-1.5 py-0.5 mb-1 bg-emerald-500/5 border-l-2 border-emerald-500/20">
                      <span className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest">Staged</span>
                    </div>
                    {stagedChanges.map((change, idx) => (
                      <FileItem key={`staged-${idx}`} change={change} />
                    ))}
                  </div>
                )}
                {unstagedChanges.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center px-1.5 py-0.5 mb-1 bg-amber-500/5 border-l-2 border-amber-500/20">
                      <span className="text-[8px] font-black text-amber-500/50 uppercase tracking-widest">Modified</span>
                    </div>
                    {unstagedChanges.map((change, idx) => (
                      <FileItem key={`unstaged-${idx}`} change={change} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-800 opacity-40">
                <Icons.Check className="w-5 h-5 mb-1" />
                <span className="text-[8px] font-black uppercase tracking-[0.2em]">Tree Clean</span>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Divider (Commit panel height resizer) */}
        <div 
          onMouseDown={startResizing}
          className="h-[2px] w-full bg-slate-800/50 hover:bg-blue-500/40 cursor-row-resize z-10 transition-colors"
        />

        {/* COMMIT PANEL (BELOW) */}
        <div 
          style={{ height: `${commitPanelHeight}px` }}
          className="flex-shrink-0 bg-slate-900/30 border border-slate-800/40 rounded-b-lg p-1.5 flex flex-col gap-1.5 overflow-hidden"
        >
          <div className="flex justify-between items-center px-0.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Commit</span>
            <button 
              onClick={handleAISuggest}
              disabled={isGenerating || project.changes.length === 0}
              className="flex items-center gap-1 text-[8px] font-black uppercase text-blue-500/80 hover:text-blue-400 disabled:opacity-20 transition-all"
            >
              <Icons.Sparkles className={`w-2.5 h-2.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'GEN...' : 'AI'}
            </button>
          </div>
          
          <div className="flex flex-col gap-1 flex-grow">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Summary..."
              className="w-full flex-grow bg-slate-950/40 border border-slate-800/60 rounded p-1.5 text-[11px] text-slate-300 placeholder-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500/20 resize-none mono leading-tight"
            />
            
            <div className="flex gap-[2px]">
              <button 
                onClick={() => {
                  onCommit(project.id, commitMessage);
                  setCommitMessage('');
                }}
                disabled={project.changes.length === 0 || !commitMessage.trim()}
                className="flex-grow bg-blue-600/80 hover:bg-blue-600 disabled:bg-slate-800/50 disabled:text-slate-700 text-white text-[9px] font-black uppercase tracking-widest py-1.5 rounded transition-all active:scale-[0.98] shadow-lg shadow-blue-500/5"
              >
                Commit Staged
              </button>
              <button 
                className="bg-slate-800/40 hover:bg-slate-800/60 text-slate-600 hover:text-slate-400 px-2 py-1.5 rounded text-[9px] font-black uppercase tracking-widest border border-slate-700/20 transition-all active:scale-[0.98]"
              >
                +All
              </button>
            </div>
          </div>

          {project.lastCommitMessage && commitPanelHeight > 100 && (
            <div className="pt-1 border-t border-slate-800/30 flex items-center justify-between text-[7px] text-slate-700 font-bold uppercase tracking-tighter px-0.5">
              <span className="truncate italic max-w-[140px]">"{project.lastCommitMessage}"</span>
              <span className="opacity-50">{project.lastCommitDate}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};