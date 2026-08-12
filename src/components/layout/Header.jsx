import React, { useRef } from 'react';
import { 
  Search, 
  Plus, 
  Menu, 
  Command, 
  ChevronRight,
  ArrowUpDown,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Database,
  LayoutGrid
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DOMAINS } from '../../types/schema';

export const Header = () => {
  const { 
    activeDomain, 
    setActiveDomain,
    currentView,
    searchQuery,
    setSearchQuery,
    priorityFilter,
    setPriorityFilter,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    setIsCreateModalOpen,
    setIsShortcutsModalOpen,
    setIsMobileSidebarOpen,
    backendConnected,
    downloadExcelFile,
    importExcelFile,
    items
  } = useWorkspace();

  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const count = await importExcelFile(file);
    if (count > 0) {
      alert(`Successfully imported ${count} tracking nodes from Excel file!`);
    }
  };

  const activeDomainMeta = DOMAINS[activeDomain] || null;

  return (
    <header className="sticky top-0 z-20 bg-[#0B0B0C]/95 backdrop-blur-md border-b border-[#262626] px-3 sm:px-4 py-2.5 flex flex-col gap-2">
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls"
        className="hidden"
      />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Section: Mobile Menu + Breadcrumb Title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-zinc-800 lg:hidden"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5 text-xs font-medium truncate">
            <span className="text-gray-400 hidden sm:inline">Nexus</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-500 hidden sm:inline" />
            
            {currentView === 'overview' ? (
              <span className="text-white font-semibold flex items-center gap-1.5 truncate">
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">Overview Hub</span>
              </span>
            ) : currentView === 'urgent' ? (
              <span className="text-rose-400 font-semibold flex items-center gap-1.5 truncate">
                <span className="truncate">Urgent Queue</span>
              </span>
            ) : currentView === 'my_tasks' ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5 truncate">
                <span className="truncate">My Assigned Nodes</span>
              </span>
            ) : currentView === 'settings' ? (
              <span className="text-purple-400 font-semibold flex items-center gap-1.5 truncate">
                <span className="truncate">Settings & Profile Management</span>
              </span>
            ) : (
              <span className="text-white font-semibold flex items-center gap-1.5 truncate">
                {activeDomainMeta ? (
                  <span className="truncate" style={{ color: activeDomainMeta.color }}>
                    {activeDomainMeta.name}
                  </span>
                ) : (
                  <span className="truncate">All Data Stack</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="flex-1 max-w-md relative hidden sm:block">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search across title, identifier, tags, assignee or citations... (/)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#151516] border border-[#262626] rounded-md pl-9 pr-12 py-1.5 text-xs text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#5E6AD2] transition-all"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
              <kbd className="hidden md:inline-block text-[10px] bg-zinc-800 text-gray-400 border border-zinc-700 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
            </div>
          </div>
        </div>

        {/* Right Section: Go Excel Engine Status + Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Go Backend Excel Indicator */}
          <div 
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border ${
              backendConnected 
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/40' 
                : 'bg-zinc-800/60 text-zinc-400 border-zinc-700'
            }`}
            title={backendConnected ? 'Connected to Go API & workspace_data.xlsx' : 'Offline local mode'}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Go Excel Engine</span>
            <span className={`w-1.5 h-1.5 rounded-full ${backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
          </div>

          {/* Excel Export Button */}
          <button
            onClick={downloadExcelFile}
            className="p-1.5 rounded-md border border-[#262626] text-emerald-400 hover:bg-emerald-950/40 hover:border-emerald-700 transition-colors flex items-center gap-1 text-xs"
            title="Download workspace_data.xlsx"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">Excel Export</span>
          </button>

          {/* Excel Import Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-md border border-[#262626] text-blue-400 hover:bg-blue-950/40 hover:border-blue-700 transition-colors flex items-center gap-1 text-xs"
            title="Upload Excel Spreadsheet"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">Import Sheet</span>
          </button>

          {/* Keyboard Shortcuts Button */}
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className="p-1.5 rounded-md border border-[#262626] text-gray-400 hover:text-white hover:bg-zinc-800 transition-colors hidden sm:block"
            title="Shortcuts (?)"
          >
            <Command className="w-4 h-4" />
          </button>

          {/* New Item Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#5E6AD2] hover:bg-[#6E7BE2] text-white text-xs font-medium py-1.5 px-2.5 sm:px-3 rounded-md flex items-center gap-1 shadow-md transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">New Item</span>
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="relative sm:hidden">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search all tracking nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#151516] border border-[#262626] rounded-md pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#5E6AD2]"
        />
      </div>

      {/* Secondary Bar: Domain Pills + Context Sorting (Mobile Scrollable) */}
      {(currentView === 'issues' || currentView === 'urgent' || currentView === 'my_tasks') && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[#1C1C1E]">
          {/* Scrollable Domain Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs no-scrollbar">
            <button
              onClick={() => setActiveDomain('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                activeDomain === 'all'
                  ? 'bg-zinc-800 text-white border border-zinc-700 font-semibold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-zinc-800/40'
              }`}
            >
              All Domains ({items.length})
            </button>

            {Object.values(DOMAINS).map(dom => {
              const count = items.filter(i => i.domain === dom.id).length;
              const isSelected = activeDomain === dom.id;
              return (
                <button
                  key={dom.id}
                  onClick={() => setActiveDomain(dom.id)}
                  className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? `${dom.badgeClass} font-semibold`
                      : 'text-gray-400 hover:text-gray-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dom.color }} />
                  <span>{dom.name}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Context Controls */}
          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
            {/* Priority Select */}
            <div className="flex items-center gap-1">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-[#151516] border border-[#262626] text-gray-300 rounded px-1.5 sm:px-2 py-1 text-xs focus:outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Status Select */}
            <div className="flex items-center gap-1">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#151516] border border-[#262626] text-gray-300 rounded px-1.5 sm:px-2 py-1 text-xs focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Sort Context Selector */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[#151516] border border-[#5E6AD2]/50 text-indigo-200 font-medium rounded px-1.5 sm:px-2 py-1 text-xs focus:outline-none"
              >
                <option value="priority">Sort: Priority</option>
                <option value="domain">Sort: Domain</option>
                <option value="status">Sort: Status</option>
                <option value="dueDate">Sort: Target Date</option>
                <option value="title">Sort: Title</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
