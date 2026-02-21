
import React, { useState, useMemo } from 'react';
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
    <div className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-800/50 transition-all group rounded border border-transparent hover:border-slate-700/30">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black mono border ${theme.border} ${theme.bg} ${theme.text}`}>
          {theme.icon}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="mono text-[12px] text-slate-200 truncate group-hover:text-white">
            {change.path.split('/').pop()}
          </span>
          <span className="text-[10px] text-slate-600 truncate mono opacity-50 hidden md:block">
            {change.path}
          </span>
        </div>
      </div>
      {change.staged && (
        <span className="text-[8px] font-black uppercase tracking-tighter text-emerald-500/60 px-1 border border-emerald-500/20 rounded">STAGED</span>
      )}
    </div>
  );
};

interface ProjectDetailsProps {
  project: Project;
  onCommit: (projectId: string, message: string) => void;
  onRefresh: (projectId: string) => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, onCommit, onRefresh }) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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
    <div className="flex flex-col h-full max-h-full overflow-hidden gap-1">
      {/* Mini Header */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-white tracking-tight truncate max-w-[200px]">{project.name}</h2>
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px] text-slate-400 font-bold mono">
            <Icons.GitBranch className="w-2.5 h-2.5" />
            {project.branch}
          </div>
        </div>
        <button 
          onClick={() => onRefresh(project.id)}
          className="p-1 rounded bg-slate-800/50 border border-slate-700 hover:bg-slate-700 transition-all text-slate-500 hover:text-white"
        >
          <Icons.Refresh className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main vertical stack to save horizontal space and place files above commit */}
      <div className="flex flex-col flex-grow min-h-0 gap-1 overflow-hidden">
        
        {/* FILE PANEL (ABOVE) */}
        <div className="flex-grow flex flex-col min-h-0 bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/50 bg-slate-900/60">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Repository Status</h3>
              <span className="text-[10px] text-slate-600 font-mono">[{project.changes.length}]</span>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                <span className="text-[8px] text-slate-600 font-bold uppercase">Modified</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                <span className="text-[8px] text-slate-600 font-bold uppercase">Added</span>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto flex-grow p-1 custom-scrollbar">
            {project.changes.length > 0 ? (
              <div className="space-y-3">
                {stagedChanges.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-2 py-0.5 mb-1 bg-emerald-500/5 border-l-2 border-emerald-500/20">
                      <span className="text-[9px] font-black text-emerald-500/60 uppercase">Staged</span>
                    </div>
                    {stagedChanges.map((change, idx) => (
                      <FileItem key={`staged-${idx}`} change={change} />
                    ))}
                  </div>
                )}
                {unstagedChanges.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-2 py-0.5 mb-1 bg-amber-500/5 border-l-2 border-amber-500/20">
                      <span className="text-[9px] font-black text-amber-500/60 uppercase">Unstaged</span>
                    </div>
                    {unstagedChanges.map((change, idx) => (
                      <FileItem key={`unstaged-${idx}`} change={change} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-700 py-4">
                <Icons.Check className="w-6 h-6 mb-1 opacity-20" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Clean Tree</p>
              </div>
            )}
          </div>
        </div>

        {/* COMMIT PANEL (BELOW) */}
        <div className="flex-shrink-0 bg-slate-800/20 border border-slate-700/30 p-2 rounded-lg flex flex-col gap-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-600">Prepare Commit</label>
            <button 
              onClick={handleAISuggest}
              disabled={isGenerating || project.changes.length === 0}
              className="flex items-center gap-1 text-[9px] font-bold uppercase text-blue-500/80 hover:text-blue-400 disabled:opacity-20 transition-colors"
            >
              <Icons.Sparkles className={`w-2.5 h-2.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Gen...' : 'AI Prompt'}
            </button>
          </div>
          
          <div className="flex flex-col gap-2">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message..."
              className="w-full bg-slate-950/50 border border-slate-700/50 rounded-md p-2 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/30 min-h-[50px] resize-none mono"
            />
            
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  onCommit(project.id, commitMessage);
                  setCommitMessage('');
                }}
                disabled={project.changes.length === 0 || !commitMessage.trim()}
                className="flex-grow bg-blue-600/90 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded transition-all active:scale-[0.98]"
              >
                Commit Staged
              </button>
              <button 
                className="bg-slate-700/30 hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 px-3 py-2 rounded text-[10px] font-black uppercase tracking-widest border border-slate-700/30 transition-all active:scale-[0.98]"
              >
                Stage All
              </button>
            </div>
          </div>

          {project.lastCommitMessage && (
            <div className="mt-1 pt-1 border-t border-slate-800/50 flex items-center justify-between text-[8px] text-slate-600 px-1">
              <span className="truncate italic max-w-[150px]">"{project.lastCommitMessage}"</span>
              <span className="font-bold">{project.lastCommitDate}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
