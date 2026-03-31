
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Project, FileChangeType, FileChange } from '../types';
import { Icons } from '../constants';
import { generateCommitMessage } from '../services/geminiService';
import { getFileContent, getFileDiff, getBranchCommits, getCommitDetails, checkoutCommit } from '../services/apiService';
import { CommitSearchModal } from './CommitSearchModal';

interface FileItemProps {
  change: FileChange;
  onStage?: () => void;
  onUnstage?: () => void;
  onView?: () => void;
  onDiff?: () => void;
  disabled?: boolean;
}

const FileItem: React.FC<FileItemProps> = ({ change, onStage, onUnstage, onView, onDiff, disabled }) => {
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
          <span className="mono text-[10px] text-slate-400 truncate leading-none">{change.path}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onView}
          className="text-[9px] font-black text-slate-400 hover:text-white px-1 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-all hidden sm:block"
          title="View file content"
        >
          VIEW
        </button>
        <button
          onClick={onDiff}
          className="text-[9px] font-black text-slate-400 hover:text-white px-1 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-all hidden sm:block"
          title="View diff"
        >
          DIFF
        </button>
        {change.staged ? (
          <button
            onClick={onUnstage}
            disabled={disabled}
            className="text-[9px] font-black text-emerald-500/80 bg-emerald-500/5 px-1.5 py-0.5 border border-emerald-500/20 rounded-sm tracking-tighter shadow-sm shadow-emerald-500/5 hover:bg-emerald-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            STAGED
          </button>
        ) : (
          <button
            onClick={onStage}
            disabled={disabled}
            className="text-[9px] font-black text-slate-300 bg-slate-500/5 px-1.5 py-0.5 border border-slate-500/20 rounded-sm tracking-tighter opacity-0 group-hover:opacity-100 hover:text-emerald-400 hover:border-emerald-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
  onDeleteBranch: (projectId: string, branchName: string) => void;
  onCommitAll: (projectId: string, message: string) => void;
  onMergeDevToMain: (projectId: string) => void;
  onMergeBranches: (projectId: string, fromBranch: string, toBranch: string) => void;
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
  onDeleteBranch,
  onCommitAll,
  onMergeDevToMain,
  onMergeBranches,
  isCommitting = false
}) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [commitPanelHeight, setCommitPanelHeight] = useState(130);
  const [isResizing, setIsResizing] = useState(false);
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [mergeFrom, setMergeFrom] = useState('');
  const [mergeTo, setMergeTo] = useState('');
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ path: string, type: 'content' | 'diff', staged: boolean, hash?: string } | null>(null);
  const [fileDetails, setFileDetails] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [branchCommits, setBranchCommits] = useState<any[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [selectedCommitDetails, setSelectedCommitDetails] = useState<{commit: any, files: any[]} | null>(null);
  const [loadingCommitDetails, setLoadingCommitDetails] = useState(false);
  const [showCommitDetails, setShowCommitDetails] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [checkoutNewBranch, setCheckoutNewBranch] = useState('');
  const [checkoutMode, setCheckoutMode] = useState<'current' | 'new'>('new');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadingCommits(true);
    getBranchCommits(project.id, project.branch, 50)
      .then(commits => {
        console.log('Fetched branch commits:', commits?.length, commits);
        setBranchCommits(commits || []);
      })
      .catch(err => console.error('Failed to load commits:', err))
      .finally(() => setLoadingCommits(false));
  }, [project.id, project.branch, project.lastCommitMessage]);

  const handleSelectCommit = async (hash: string) => {
    if (!hash) return;
    setShowCommitDetails(true);
    setLoadingCommitDetails(true);
    setSelectedCommitDetails(null);
    try {
      const details = await getCommitDetails(project.id, hash);
      setSelectedCommitDetails(details);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCommitDetails(false);
    }
  };

  const handleCheckoutCommit = async () => {
    if (!selectedCommitDetails) return;
    const hash = selectedCommitDetails.commit.hash;
    const newBranch = checkoutMode === 'new' ? checkoutNewBranch.trim() : undefined;
    
    if (checkoutMode === 'new' && !newBranch) return;
    
    setCheckoutLoading(true);
    try {
      await checkoutCommit(project.id, hash, newBranch);
      onRefresh(project.id);
      setShowCommitDetails(false);
      setShowCheckoutDialog(false);
      setCheckoutNewBranch('');
    } catch (err: any) {
      console.error('Checkout error:', err);
      alert('Checkout failed: ' + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedFile) {
      setFileDetails('');
      return;
    }
    setLoadingDetails(true);
    setFileDetails('Loading...');

    if (selectedFile.type === 'content') {
      getFileContent(project.id, selectedFile.path)
        .then(content => setFileDetails(content))
        .catch(err => setFileDetails('Error: ' + err.message))
        .finally(() => setLoadingDetails(false));
    } else {
      getFileDiff(project.id, selectedFile.path, selectedFile.staged, selectedFile.hash)
        .then(diff => setFileDetails(diff))
        .catch(err => setFileDetails('Error: ' + err.message))
        .finally(() => setLoadingDetails(false));
    }
  }, [selectedFile, project.id]);

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
          <h2 className="text-sm font-black text-white uppercase tracking-wider truncate flex-shrink-0 mr-2">{project.name}</h2>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-fade-right ml-1 border-l border-slate-800/60 pl-2">
            {sortedBranches.map(b => {
              const canDelete = b !== project.branch && !project.locked && b !== 'main' && b !== 'master' && b !== 'dev' && b !== 'develop';
              return (
                <div key={b} className="relative group flex items-center">
                  <button
                    onClick={() => onBranchSwitch(project.id, b)}
                    disabled={project.locked}
                    className={`px-2 py-0.5 rounded border text-xs mono font-bold transition-all whitespace-nowrap ${
                      canDelete ? 'pr-6' : ''
                    } ${b === project.branch
                      ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
                      }`}
                  >
                    {b}
                  </button>
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setBranchToDelete(b); }}
                      className="absolute right-0 top-0 bottom-0 px-1 opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-r transition-all flex items-center justify-center"
                      title={`Delete branch ${b}`}
                    >
                      <Icons.Close className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* COMMIT SELECTOR - UNIVERSAL POSITION */}
          <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 bg-emerald-600/20 border border-emerald-500/40 rounded-md shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            <Icons.Commit className="w-3 h-3 text-emerald-400" />
            <select
              className="bg-transparent text-emerald-300 text-[10px] font-bold mono outline-none cursor-pointer max-w-[150px] hover:text-emerald-200 transition-colors"
              onChange={(e) => {
                if (e.target.value) {
                  handleSelectCommit(e.target.value);
                  e.target.value = ''; 
                }
              }}
            >
              <option value="" className="bg-slate-900 text-slate-500">
                {loadingCommits ? 'Loading...' : `COMMITS (${branchCommits.length})`}
              </option>
              {branchCommits.map(c => (
                <option key={c.hash} value={c.hash} className="bg-slate-900 text-slate-200">
                  {c.hash.substring(0, 7)} - {c.message}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              // FROM = current branch
              setMergeFrom(project.branch);
              // INTO = main/master if possible, else some other branch
              const target = sortedBranches.find(b => (b === 'main' || b === 'master') && b !== project.branch)
                || sortedBranches.find(b => b !== project.branch);
              setMergeTo(target || '');
              setShowMergeModal(true);
            }}
            disabled={project.locked || sortedBranches.length < 2}
            className="p-1.5 rounded text-indigo-500/80 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 group"
            title={project.locked ? "Project is locked" : sortedBranches.length < 2 ? "Need 2+ branches" : `Merge ${project.branch} into...`}
          >
            <Icons.GitBranch className="w-3.5 h-3.5 rotate-180 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Merge</span>
          </button>
          <button
            onClick={() => setShowSearchModal(true)}
            disabled={project.locked}
            className="p-1 rounded text-emerald-500/80 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed group"
            title={project.locked ? "Project is locked" : "Search commits"}
          >
            <Icons.Search className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          </button>
          <button
            onClick={() => setShowCreateBranch(true)}
            disabled={project.locked}
            className="p-1 rounded text-blue-500/80 hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={project.locked ? "Project is locked" : "Create new branch"}
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
                      onView={() => setSelectedFile({ path: c.path, type: 'content', staged: true })}
                      onDiff={() => setSelectedFile({ path: c.path, type: 'diff', staged: true })}
                      disabled={project.locked}
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
                      onView={() => setSelectedFile({ path: c.path, type: 'content', staged: false })}
                      onDiff={() => setSelectedFile({ path: c.path, type: 'diff', staged: false })}
                      disabled={project.locked}
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
      <div style={{ height: `${commitPanelHeight}px` }} className="flex-shrink-0 bg-slate-900/30 border border-slate-800/40 rounded-b-lg p-2 flex flex-col gap-2 overflow-y-auto backdrop-blur-sm custom-scrollbar">
        <div className="flex justify-between items-center px-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Commit Message</span>
            {project.locked && (
              <span className="flex items-center gap-1 text-[9px] font-black text-amber-500/80 uppercase tracking-wider">
                <Icons.Lock className="w-3 h-3" /> LOCKED
              </span>
            )}
          </div>
          <button onClick={handleAISuggest} disabled={isGenerating || project.changes.length === 0 || project.locked} className="flex items-center gap-1.5 text-[10px] font-black text-blue-500/80 uppercase hover:text-blue-400 disabled:opacity-20 transition-all">
            <Icons.Sparkles className={`w-2.5 h-2.5 ${isGenerating ? 'animate-spin' : ''}`} /> {isGenerating ? 'ANALYZING...' : 'AI SUGGEST'}
          </button>
        </div>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder={project.locked ? "Project is locked - unlock to commit" : "What's changed in this commit?..."}
          disabled={project.locked}
          className="w-full flex-grow bg-slate-950/60 border border-slate-800/60 rounded p-2 text-sm text-slate-300 outline-none focus:ring-1 focus:ring-blue-500/30 resize-none mono leading-relaxed placeholder-slate-500 disabled:opacity-50"
        />
        <div className="flex flex-wrap gap-1.5 flex-shrink-0">
          <button
            onClick={() => { onCommit(project.id, commitMessage); setCommitMessage(''); }}
            disabled={!commitMessage.trim() || isCommitting || stagedChanges.length === 0 || project.locked}
            className="flex-grow min-w-[120px] bg-blue-600/90 hover:bg-blue-600 disabled:bg-slate-800/50 text-white text-xs font-black uppercase tracking-widest py-2 rounded shadow-lg shadow-blue-500/5 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
            disabled={!commitMessage.trim() || isCommitting || project.changes.length === 0 || project.locked}
            className="bg-emerald-600/90 hover:bg-emerald-600 disabled:bg-slate-800/50 text-white text-xs font-black uppercase tracking-wider px-3 py-2 rounded shadow-lg shadow-emerald-500/5 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 whitespace-nowrap"
            title={project.locked ? "Project is locked" : "Stage all files and commit (like git commit -a)"}
          >
            {isCommitting ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>Commit All</>
            )}
          </button>
          <button
            onClick={() => onMergeDevToMain(project.id)}
            disabled={isCommitting || project.locked || project.branch !== 'dev'}
            className="bg-purple-600/90 hover:bg-purple-600 disabled:bg-slate-800/50 text-white text-[10px] font-black uppercase tracking-wider px-2 py-2 rounded shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-1 whitespace-nowrap"
            title={project.locked ? "Project is locked" : project.branch !== 'dev' ? "Only available on dev branch" : "Merge dev into main"}
          >
            {isCommitting ? <span className="w-3 h-3 border-2 border-t-white rounded-full animate-spin"></span> : <>dev→main</>}
          </button>
          <button
            onClick={() => onStageAll(project.id)}
            disabled={unstagedChanges.length === 0 || project.locked}
            className="bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 text-xs font-black uppercase px-3 py-2 rounded border border-slate-700/20 transition-all active:scale-[0.98] disabled:cursor-not-allowed"
            title={project.locked ? "Project is locked" : "Stage all files"}
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
      {/* Merge Branches Modal */}
      {showMergeModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-xl p-4 flex flex-col gap-4 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">Merge Branches</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">From Branch</label>
                <select
                  value={mergeFrom}
                  onChange={(e) => setMergeFrom(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/30 mono"
                >
                  {sortedBranches.map(b => (
                    <option key={b} value={b} disabled={b === mergeTo}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Into Branch</label>
                <select
                  value={mergeTo}
                  onChange={(e) => setMergeTo(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500/30 mono"
                >
                  {sortedBranches.map(b => (
                    <option key={b} value={b} disabled={b === mergeFrom}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {mergeFrom === mergeTo && (
              <p className="text-[10px] text-rose-500 font-bold uppercase text-center">Cannot merge a branch into itself</p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/40">
              <button
                onClick={() => { setShowMergeModal(false); }}
                className="text-[10px] text-slate-500 font-bold uppercase px-3 hover:text-slate-300 transition-colors"
                disabled={isCommitting}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (mergeFrom && mergeTo && mergeFrom !== mergeTo) {
                    onMergeBranches(project.id, mergeFrom, mergeTo);
                    setShowMergeModal(false);
                  }
                }}
                disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo || isCommitting}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:opacity-30 text-white text-[10px] font-black uppercase px-6 py-2 rounded transition-all active:scale-95 shadow-lg shadow-indigo-600/10"
              >
                {isCommitting ? "Merging..." : "Confirm Merge"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Branch Modal */}
      {branchToDelete && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xs rounded-xl p-4 flex flex-col gap-3 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-widest text-rose-400">Delete Branch</h3>
            <p className="text-[10px] text-slate-300">
              Are you sure you want to delete <span className="text-white font-mono bg-slate-800 px-1 py-0.5 rounded border border-slate-700">{branchToDelete}</span>?
            </p>
            <p className="text-[9px] text-slate-500 uppercase font-bold">This action cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-800/40">
              <button 
                onClick={() => setBranchToDelete(null)} 
                className="text-[10px] text-slate-500 font-bold uppercase px-3 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onDeleteBranch(project.id, branchToDelete);
                  setBranchToDelete(null);
                }} 
                className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase px-4 py-1.5 rounded transition-all active:scale-95 shadow-lg shadow-rose-600/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showSearchModal && (
        <CommitSearchModal
          projectId={project.id}
          onClose={() => setShowSearchModal(false)}
          onViewDiff={(path, hash) => {
             setSelectedFile({ path, type: 'diff', staged: false, hash });
          }}
        />
      )}

      {/* File Details (Content/Diff) Modal */}
      {selectedFile && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {selectedFile.type === 'content' ? 'File Content' : 'File Diff'} {selectedFile.staged ? '(Staged)' : ''}
                </span>
                <span className="text-sm font-bold text-slate-200 mono truncate">{selectedFile.path}</span>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close"
              >
                <Icons.Close className="w-5 h-5" />
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div className="flex-grow p-4 overflow-hidden flex flex-col min-h-0 bg-slate-950/50">
              {loadingDetails ? (
                <div className="flex items-center justify-center h-full">
                  <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></span>
                </div>
              ) : selectedFile.type === 'diff' ? (
                <div className="w-full h-full bg-slate-950 border border-slate-800 rounded p-4 text-[13px] outline-none overflow-y-auto mono leading-relaxed custom-scrollbar bg-slate-950/80">
                  {fileDetails.split('\n').map((line, i) => {
                    let className = "text-slate-300";
                    let bgClass = "hover:bg-slate-800/40 px-2 rounded-sm";

                    if (line.startsWith('+') && !line.startsWith('+++')) {
                      className = "text-emerald-400";
                      bgClass = "bg-emerald-500/10 hover:bg-emerald-500/20 px-2 rounded-sm";
                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                      className = "text-rose-400";
                      bgClass = "bg-rose-500/10 hover:bg-rose-500/20 px-2 rounded-sm";
                    } else if (line.startsWith('@@ ')) {
                      className = "text-sky-400 font-bold";
                      bgClass = "bg-sky-500/10 px-2 py-1 mt-2 mb-1 rounded-sm block";
                    } else if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
                      className = "text-slate-500 font-bold";
                      bgClass = "px-2 block";
                    }

                    return (
                      <div key={i} className={`whitespace-pre-wrap break-all ${className} ${bgClass}`}>
                        {line || ' '}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  readOnly
                  value={fileDetails}
                  className="w-full h-full bg-slate-950 border border-slate-800 rounded p-4 text-sm text-slate-300 outline-none resize-none mono leading-relaxed custom-scrollbar whitespace-pre"
                />
              )}
            </div>
            <div className="flex justify-end p-3 border-t border-slate-800 bg-slate-900/50">
              <button
                onClick={() => setSelectedFile(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider px-6 py-2 rounded transition-all active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Branch Commit Details Modal */}
      {showCommitDetails && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[85vh] rounded-xl flex flex-col shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
              <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                Commit Details
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowCheckoutDialog(true); setCheckoutMode('new'); setCheckoutNewBranch(''); }}
                  disabled={project.locked}
                  className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title={project.locked ? "Project is locked" : "Checkout this commit"}
                >
                  Checkout
                </button>
                <button onClick={() => setShowCommitDetails(false)} className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800">
                  <Icons.Close className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-grow overflow-hidden flex flex-col bg-slate-950">
              {loadingCommitDetails ? (
                <div className="flex justify-center items-center h-full p-8">
                   <span className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></span>
                </div>
              ) : selectedCommitDetails ? (
                <>
                  <div className="p-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
                    <div className="flex gap-2 items-center mb-2">
                      <span 
                        className="text-[10px] mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 cursor-pointer hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1.5"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedCommitDetails.commit.hash);
                          setCopiedHash(true);
                          setTimeout(() => setCopiedHash(false), 2000);
                        }}
                        title="Click to copy full hash"
                      >
                        {selectedCommitDetails.commit.hash}
                        <Icons.Copy className="w-3 h-3 text-slate-500 hover:text-emerald-400" />
                        {copiedHash && <span className="text-emerald-400 text-[9px] font-bold">COPIED!</span>}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                        {new Date(selectedCommitDetails.commit.date).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-200 whitespace-pre-wrap leading-relaxed">{selectedCommitDetails.commit.message}</h4>
                    {selectedCommitDetails.commit.body && (
                      <p className="text-xs text-slate-400 mt-2 whitespace-pre-wrap">{selectedCommitDetails.commit.body}</p>
                    )}
                    <div className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-800/50">
                      By {selectedCommitDetails.commit.author_name} &lt;{selectedCommitDetails.commit.author_email}&gt;
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900/80 border-b border-slate-800 shrink-0 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{selectedCommitDetails.files.length} files changed</span>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar p-2 relative">
                    {selectedCommitDetails.files.length > 0 ? (
                      selectedCommitDetails.files.map((f, i) => {
                        let theme = { text: 'text-slate-400', bg: 'bg-slate-400/5', border: 'border-slate-400/10' };
                        if (f.status === 'A') theme = { text: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-500/20' };
                        if (f.status === 'M') theme = { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-500/20' };
                        if (f.status === 'D') theme = { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-500/20' };

                        return (
                          <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-800/60 transition-all group rounded border border-transparent hover:border-slate-800 mb-1 pl-3">
                            <div className="flex items-center gap-3 min-w-0 pr-2">
                              <div className={`w-4 h-4 shrink-0 rounded flex items-center justify-center text-[10px] font-black mono border shadow-sm ${theme.border} ${theme.bg} ${theme.text}`}>
                                {f.status}
                              </div>
                              <span className="mono text-[11px] text-slate-300 truncate group-hover:text-white" title={f.path}>{f.path}</span>
                            </div>
                            <button
                              onClick={() => {
                                setShowCommitDetails(false);
                                setSelectedFile({ path: f.path, type: 'diff', staged: false, hash: selectedCommitDetails.commit.hash });
                              }}
                              className="text-[9px] font-black tracking-widest bg-emerald-500/10 text-emerald-400 hover:text-white hover:bg-emerald-500 px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-all border border-emerald-500/20 shrink-0"
                            >
                              DIFF
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-xs italic opacity-50">Empty commit / No files changed</div>
                    )}
                  </div>
                  {showCheckoutDialog && selectedCommitDetails && (
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-10 flex items-center justify-center p-4">
                      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-md w-full shadow-2xl">
                        <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider mb-3">Checkout Commit</h3>
                        <p className="text-xs text-slate-400 mb-4 mono">{selectedCommitDetails.commit.hash.substring(0, 10)}... — {selectedCommitDetails.commit.message}</p>
                        
                        <div className="flex flex-col gap-3 mb-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="checkoutMode" checked={checkoutMode === 'new'} onChange={() => setCheckoutMode('new')} className="accent-amber-500" />
                            <span className="text-xs font-bold text-slate-300">Создать новую ветку от этого коммита</span>
                          </label>
                          {checkoutMode === 'new' && (
                            <input
                              type="text"
                              value={checkoutNewBranch}
                              onChange={(e) => setCheckoutNewBranch(e.target.value)}
                              placeholder="branch-name"
                              className="ml-5 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 mono outline-none focus:border-amber-500/50"
                              autoFocus
                            />
                          )}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="checkoutMode" checked={checkoutMode === 'current'} onChange={() => setCheckoutMode('current')} className="accent-rose-500" />
                            <span className="text-xs font-bold text-slate-300">Откатить текущую ветку <span className="text-rose-400">({project.branch})</span> на этот коммит</span>
                          </label>
                          {checkoutMode === 'current' && (
                            <p className="ml-5 text-[10px] text-rose-400/80 font-bold uppercase">⚠ Все коммиты после выбранного будут потеряны!</p>
                          )}
                        </div>

                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setShowCheckoutDialog(false)}
                            className="px-3 py-1.5 rounded text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCheckoutCommit}
                            disabled={checkoutLoading || (checkoutMode === 'new' && !checkoutNewBranch.trim())}
                            className={`px-3 py-1.5 rounded text-xs font-black uppercase tracking-wider transition-all disabled:opacity-30 ${
                              checkoutMode === 'current' 
                                ? 'bg-rose-600/80 hover:bg-rose-600 text-white' 
                                : 'bg-amber-600/80 hover:bg-amber-600 text-white'
                            }`}
                          >
                            {checkoutLoading ? 'Processing...' : checkoutMode === 'current' ? 'Reset Branch' : 'Create Branch'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-center items-center h-full p-8 text-slate-500">
                   Failed to load commit details
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
