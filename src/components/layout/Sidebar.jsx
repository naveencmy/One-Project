import React from 'react';
import { 
  LayoutGrid, 
  Layers, 
  AlertTriangle, 
  UserCheck, 
  FolderGit2, 
  BookOpen, 
  Calendar, 
  Users, 
  FileText, 
  Plus, 
  HelpCircle, 
  Lock, 
  X,
  Settings,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DOMAINS } from '../../types/schema';

export const Sidebar = () => {
  const { 
    items, 
    userProfile,
    activeDomain, 
    setActiveDomain, 
    currentView, 
    setCurrentView, 
    setIsCreateModalOpen,
    setIsShortcutsModalOpen,
    lockPin,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen
  } = useWorkspace();

  const getDomainCount = (domainKey) => {
    if (domainKey === 'all') return items.length;
    return items.filter(item => item.domain === domainKey).length;
  };

  const getUrgentCount = () => {
    return items.filter(item => item.priority === 'urgent' && item.status !== 'done').length;
  };

  const domainIconMap = {
    projects: FolderGit2,
    academic: BookOpen,
    events: Calendar,
    teams: Users,
    other: FileText
  };

  const handleDomainSelect = (domainKey) => {
    setActiveDomain(domainKey);
    if ((currentView === 'overview' || currentView === 'settings' || currentView === 'gantt') && domainKey !== 'all') {
      setCurrentView('issues');
    }
    setIsMobileSidebarOpen(false);
  };

  const handleViewSelect = (viewKey) => {
    setCurrentView(viewKey);
    setIsMobileSidebarOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#151516] border-r border-[#262626] text-gray-300 w-64 select-none">
      {/* Workspace Branding Header */}
      <div className="p-4 border-b border-[#262626] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#5E6AD2] to-[#8B5CF6] flex items-center justify-center text-white font-bold shadow-lg shadow-[#5E6AD2]/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-white tracking-wide">KernelRaise Workspace</span>
              <span className="text-[10px] bg-[#5E6AD2]/20 text-[#6E7BE2] px-1.5 py-0.5 rounded font-mono font-medium border border-[#5E6AD2]/30">v2.4</span>
            </div>
            <p className="text-[11px] text-gray-400">Unified Multi-Domain Engine</p>
          </div>
        </div>

        {isMobileSidebarOpen && (
          <button 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-zinc-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Primary Action Button */}
      <div className="p-3">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="w-full bg-[#5E6AD2] hover:bg-[#6E7BE2] text-white text-xs font-semibold py-2 px-3 rounded-md flex items-center justify-center gap-2 shadow-md shadow-[#5E6AD2]/20 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New Tracking Node</span>
          <span className="ml-auto text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono text-indigo-200">C</span>
        </button>
      </div>

      {/* Scrollable Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-6">
        {/* Core Views */}
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Workspace Views
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => handleViewSelect('overview')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                currentView === 'overview' && activeDomain === 'all'
                  ? 'bg-[#26262B] text-white border-l-2 border-[#5E6AD2]'
                  : 'text-gray-300 hover:bg-[#1E1E21] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutGrid className="w-4 h-4 text-indigo-400" />
                <span>Overview Hub</span>
              </div>
            </button>

            <button
              onClick={() => handleViewSelect('gantt')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                currentView === 'gantt'
                  ? 'bg-[#26262B] text-white border-l-2 border-violet-500'
                  : 'text-gray-300 hover:bg-[#1E1E21] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 text-violet-400" />
                <span>Full Gantt Timeline</span>
              </div>
              <span className="text-[10px] font-mono bg-violet-950/80 text-violet-300 px-1.5 py-0.5 rounded border border-violet-800/40">
                Full Page
              </span>
            </button>

            <button
              onClick={() => handleViewSelect('issues')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                currentView === 'issues' && activeDomain === 'all'
                  ? 'bg-[#26262B] text-white border-l-2 border-[#5E6AD2]'
                  : 'text-gray-300 hover:bg-[#1E1E21] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>All Issues & Data Stack</span>
              </div>
              <span className="text-[10px] font-mono bg-zinc-800 text-gray-400 px-1.5 py-0.5 rounded-full">
                {items.length}
              </span>
            </button>

            <button
              onClick={() => handleViewSelect('urgent')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                currentView === 'urgent'
                  ? 'bg-[#26262B] text-white border-l-2 border-rose-500'
                  : 'text-gray-300 hover:bg-[#1E1E21] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Urgent Action Queue</span>
              </div>
              {getUrgentCount() > 0 && (
                <span className="text-[10px] font-mono bg-rose-950 text-rose-400 px-1.5 py-0.5 rounded-full border border-rose-800/40">
                  {getUrgentCount()}
                </span>
              )}
            </button>

            <button
              onClick={() => handleViewSelect('my_tasks')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                currentView === 'my_tasks'
                  ? 'bg-[#26262B] text-white border-l-2 border-emerald-500'
                  : 'text-gray-300 hover:bg-[#1E1E21] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>My Assigned Nodes</span>
              </div>
            </button>

            <button
              onClick={() => handleViewSelect('settings')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                currentView === 'settings'
                  ? 'bg-[#26262B] text-white border-l-2 border-purple-500'
                  : 'text-gray-300 hover:bg-[#1E1E21] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-purple-400" />
                <span>Settings & Profile</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tracking Domains */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            <span>Tracking Domains</span>
            <span className="text-[10px] font-normal text-gray-400">5 Active</span>
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => handleDomainSelect('all')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeDomain === 'all' && currentView !== 'urgent' && currentView !== 'my_tasks' && currentView !== 'settings'
                  ? 'bg-[#26262B] text-white'
                  : 'text-gray-300 hover:bg-[#1E1E21] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 via-emerald-400 to-purple-400" />
                <span>All Domains</span>
              </div>
              <span className="text-[10px] font-mono bg-zinc-800/80 text-gray-400 px-1.5 py-0.5 rounded">
                {items.length}
              </span>
            </button>

            {Object.values(DOMAINS).map(dom => {
              const IconComponent = domainIconMap[dom.id] || FileText;
              const isSelected = activeDomain === dom.id;
              const count = getDomainCount(dom.id);

              return (
                <button
                  key={dom.id}
                  onClick={() => handleDomainSelect(dom.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-[#26262B] text-white font-semibold'
                      : 'text-gray-300 hover:bg-[#1E1E21] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <IconComponent className="w-4 h-4 shrink-0" style={{ color: dom.color }} />
                    <span className="truncate">{dom.name}</span>
                  </div>
                  <span 
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: `${dom.color}15`, color: dom.color, border: `1px solid ${dom.color}30` }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Utilities */}
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Utilities
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => setIsShortcutsModalOpen(true)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:bg-[#1E1E21] hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                <span>Keyboard Shortcuts</span>
              </div>
              <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-gray-400">?</span>
            </button>

            <button
              onClick={() => lockPin()}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:bg-[#1E1E21] hover:text-amber-400 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Lock Profile PIN</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* User Profile Footer (Clickable to open Settings!) */}
      <div 
        onClick={() => handleViewSelect('settings')}
        className="p-3 border-t border-[#262626] bg-[#111112] hover:bg-[#1A1A1E] cursor-pointer transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {userProfile.avatar ? (
              <img
                src={userProfile.avatar}
                alt={userProfile.name || 'User'}
                className="w-7 h-7 rounded-full object-cover border border-[#262626] shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#5E6AD2]/20 border border-[#5E6AD2]/30 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-indigo-300">
                  {(userProfile.name || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="leading-none min-w-0">
              <div className="text-xs font-semibold text-gray-200 group-hover:text-indigo-300 transition-colors truncate">
                {userProfile.name}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                {userProfile.role}
              </div>
            </div>
          </div>
          <Settings className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors shrink-0" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:block h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </div>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 h-full animate-slide-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
