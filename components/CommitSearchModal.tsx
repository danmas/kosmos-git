import React, { useState } from 'react';
import { Icons } from '../constants';
import { searchCommits, getCommitDetails } from '../services/apiService';

interface CommitSearchModalProps {
  projectId: string;
  onClose: () => void;
  onViewDiff: (path: string, hash: string) => void;
}

export const CommitSearchModal: React.FC<CommitSearchModalProps> = ({ projectId, onClose, onViewDiff }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<any | null>(null);
  const [commitFiles, setCommitFiles] = useState<any[]>([]);
  const [isLoadingCommit, setIsLoadingCommit] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearched(true);
    setSelectedCommit(null);
    try {
      const commits = await searchCommits(projectId, query.trim());
      setResults(commits);
    } catch (err: any) {
      console.error('Search error', err);
      alert(`Ошибка поиска: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCommit = async (hash: string) => {
    setIsLoadingCommit(true);
    const result = results.find(c => c.hash === hash);
    setSelectedCommit(result);
    try {
      const details = await getCommitDetails(projectId, hash);
      setCommitFiles(details.files || []);
    } catch (err) {
      console.error('Commit details error', err);
    } finally {
      setIsLoadingCommit(false);
    }
  };

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  const getTheme = (type: string) => {
    switch (type) {
      case 'A': return { text: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-500/20' };
      case 'M': return { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-500/20' };
      case 'D': return { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-500/20' };
      default: return { text: 'text-slate-400', bg: 'bg-slate-400/5', border: 'border-slate-400/10' };
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl h-[80vh] rounded-xl flex flex-col shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
            <Icons.Search className="w-4 h-4" /> Search Commits
          </h3>
          <button onClick={onClose} className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800">
            <Icons.Close className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-grow min-h-0">
          {/* Left panel: Search & Results */}
          <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-slate-800 max-h-[40vh] md:max-h-full">
            <div className="p-3 border-b border-slate-800 bg-slate-950 flex gap-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search words in commits..."
                className="flex-grow bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500/30 font-mono"
              />
              <button 
                onClick={handleSearch} 
                disabled={isSearching}
                className="bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 rounded text-xs font-black uppercase tracking-wider transition-all"
              >
                {isSearching ? '...' : 'Search'}
              </button>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar p-2 bg-slate-900/30 relative">
              {isSearching && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px]">
                  <div className="flex flex-col items-center gap-3">
                    <span className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 animate-pulse">Searching History...</span>
                  </div>
                </div>
              )}
              {!searched ? (
                 <div className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest mt-10">Enter query to search</div>
              ) : (results.length === 0 && !isSearching) ? (
                 <div className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest mt-10">No commits found</div>
              ) : (
                results.map(c => (
                  <div 
                    key={c.hash} 
                    onClick={() => handleSelectCommit(c.hash)}
                    className={`p-3 mb-1.5 border rounded cursor-pointer transition-all ${selectedCommit?.hash === c.hash ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800'}`}
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="text-xs font-bold text-slate-200 line-clamp-2 leading-tight" title={c.message}>{c.message}</span>
                      <span className="text-[10px] text-emerald-400 mono shrink-0">{c.hash.substring(0, 7)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2">
                      <span className="truncate pr-2">{c.author_name}</span>
                      <span className="shrink-0">{formatDate(c.date)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Commit details */}
          <div className="w-full md:w-1/2 flex flex-col bg-slate-950 overflow-hidden">
            {isLoadingCommit ? (
               <div className="flex justify-center items-center h-full">
                  <span className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></span>
               </div>
            ) : selectedCommit ? (
              <>
                <div className="p-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
                  <div className="flex gap-2 items-center mb-2">
                    <span className="text-[10px] mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">{selectedCommit.hash}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{formatDate(selectedCommit.date)}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 whitespace-pre-wrap leading-relaxed">{selectedCommit.message}</h4>
                  <div className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-800/50">By {selectedCommit.author_name} &lt;{selectedCommit.author_email}&gt;</div>
                </div>
                <div className="p-3 bg-slate-900/80 border-b border-slate-800 shrink-0 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{commitFiles.length} files changed</span>
                </div>
                <div className="flex-grow overflow-y-auto custom-scrollbar p-2 relative">
                  {commitFiles.length > 0 ? (
                    commitFiles.map((f, i) => {
                      const theme = getTheme(f.status);
                      return (
                        <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-800/60 transition-all group rounded border border-transparent hover:border-slate-800 mb-1 pl-3">
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div className={`w-4 h-4 shrink-0 rounded flex items-center justify-center text-[10px] font-black mono border shadow-sm ${theme.border} ${theme.bg} ${theme.text}`}>
                              {f.status}
                            </div>
                            <span className="mono text-[11px] text-slate-300 truncate group-hover:text-white" title={f.path}>{f.path}</span>
                          </div>
                          <button
                            onClick={() => onViewDiff(f.path, selectedCommit.hash)}
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
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-800 opacity-20">
                <Icons.Search className="w-12 h-12 mb-3" />
                <span className="text-xs font-black uppercase tracking-[0.2em]">Select a commit resulting from query</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
