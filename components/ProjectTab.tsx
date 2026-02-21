
import React from 'react';
import { Project, GitStatus } from '../types';
import { Icons } from '../constants';

interface ProjectTabProps {
  project: Project;
  isActive: boolean;
  onClick: () => void;
}

export const ProjectTab: React.FC<ProjectTabProps> = ({ project, isActive, onClick }) => {
  const getBulbGlow = () => {
    if (project.status === GitStatus.CLEAN) return 'text-emerald-500/80 drop-shadow-[0_0_4px_rgba(16,185,129,0.3)]';
    if (project.status === GitStatus.DIRTY) return 'text-rose-500/80 drop-shadow-[0_0_4px_rgba(244,63,94,0.3)]';
    return 'text-amber-400/80 drop-shadow-[0_0_4px_rgba(251,191,36,0.3)]';
  };

  return (
    <button
      onClick={onClick}
      className={`w-full group flex items-center justify-between p-2 mb-1 rounded-lg transition-all duration-150 border ${
        isActive 
          ? 'bg-slate-800 border-blue-500/30 shadow-sm' 
          : 'bg-transparent border-transparent hover:bg-slate-800/40 hover:border-slate-800'
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <Icons.Bulb className={`w-3.5 h-3.5 flex-shrink-0 transition-all ${getBulbGlow()}`} />
        <div className="text-left overflow-hidden">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>
              {project.name}
            </span>
            <span className="text-[10px] text-slate-500 italic flex-shrink-0 truncate">({project.branch})</span>
          </div>
        </div>
      </div>
      
      {project.changes.length > 0 && (
        <span className="bg-rose-500/10 text-rose-500 text-[8px] font-bold px-1 py-0.5 rounded border border-rose-500/20">
          {project.changes.length}
        </span>
      )}
    </button>
  );
};
