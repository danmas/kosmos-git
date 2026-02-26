
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
    if (project.status === GitStatus.CLEAN) return 'text-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.2)]';
    if (project.status === GitStatus.DIRTY) return 'text-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.3)]';
    return 'text-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.3)]';
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-1.5 mb-[2px] rounded transition-all duration-75 border ${isActive
          ? 'bg-slate-800/80 border-blue-500/20 shadow-sm'
          : 'bg-transparent border-transparent hover:bg-slate-800/30 hover:border-slate-800/50'
        }`}
    >
      <div className="flex items-center gap-1.5 overflow-hidden">
        <Icons.Bulb className={`w-3 h-3 flex-shrink-0 ${getBulbGlow()}`} />
        <div className="text-left overflow-hidden">
          <div className="flex items-center gap-1">
            <span className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>
              {project.name}
            </span>
            {project.locked && (
              <Icons.Lock className="w-3 h-3 text-amber-500/80 flex-shrink-0" />
            )}
            <span className="text-xs text-slate-400 italic flex-shrink-0 truncate">
              ({project.branch})
            </span>
          </div>
        </div>
      </div>

      {project.changes.length > 0 && (
        <span className="bg-rose-500/10 text-rose-500 text-[10px] font-black px-1 py-0.5 rounded-sm border border-rose-500/20 leading-none">
          {project.changes.length}
        </span>
      )}
    </button>
  );
};
