import React from 'react';
import { 
  FolderGit2, 
  BookOpen, 
  Calendar, 
  Users, 
  FileText, 
  AlertTriangle, 
  Clock, 
  ChevronRight, 
  CheckCircle2, 
  GitBranch, 
  MapPin, 
  ShieldCheck, 
  Zap
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DOMAINS, PRIORITIES, STATUSES } from '../../types/schema';
import { getShortId } from '../../utils/formatters';

export const IssuesDataStack = () => {
  const { 
    items, 
    activeDomain, 
    setActiveDomain, 
    currentView,
    searchQuery, 
    priorityFilter, 
    statusFilter, 
    sortBy, 
    openItemDetails,
    selectedItemId
  } = useWorkspace();

  const domainIconMap = {
    projects: FolderGit2,
    academic: BookOpen,
    events: Calendar,
    teams: Users,
    other: FileText
  };

  // 1. Filter items
  let filteredItems = items.filter(item => {
    if (currentView === 'urgent' && (item.priority !== 'urgent' || item.status === 'done')) {
      return false;
    }
    if (currentView === 'my_tasks' && item.assignee?.name !== 'Elena Vance') {
      return false;
    }

    if (activeDomain !== 'all' && item.domain !== activeDomain) {
      return false;
    }

    if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
      return false;
    }

    if (statusFilter !== 'all' && item.status !== statusFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = item.id.toLowerCase().includes(q);
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchAssignee = item.assignee?.name?.toLowerCase().includes(q) || false;
      const matchTags = item.tags?.some(t => t.toLowerCase().includes(q)) || false;
      const matchDesc = item.description?.toLowerCase().includes(q) || false;

      const matchProject = item.projectMetrics?.repoUrl?.toLowerCase().includes(q) || item.projectMetrics?.targetRelease?.toLowerCase().includes(q);
      const matchAcademic = item.academicMetrics?.paperTitle?.toLowerCase().includes(q) || item.academicMetrics?.advisorFeedback?.toLowerCase().includes(q);
      const matchEvent = item.eventMetrics?.locationCoordinates?.toLowerCase().includes(q) || item.eventMetrics?.eventType?.toLowerCase().includes(q);
      const matchTeam = item.teamMetrics?.teamName?.toLowerCase().includes(q) || item.teamMetrics?.throughputVelocity?.toLowerCase().includes(q);

      return matchId || matchTitle || matchAssignee || matchTags || matchDesc || matchProject || matchAcademic || matchEvent || matchTeam;
    }

    return true;
  });

  // 2. Sort filtered items
  filteredItems.sort((a, b) => {
    if (sortBy === 'priority') {
      const rankA = PRIORITIES[a.priority]?.rank || 0;
      const rankB = PRIORITIES[b.priority]?.rank || 0;
      return rankB - rankA;
    }
    if (sortBy === 'domain') {
      return a.domain.localeCompare(b.domain);
    }
    if (sortBy === 'status') {
      const statusOrder = { in_progress: 5, in_review: 4, urgent: 3, todo: 2, backlog: 1, done: 0 };
      return (statusOrder[b.status] || 0) - (statusOrder[a.status] || 0);
    }
    if (sortBy === 'dueDate') {
      return new Date(a.dueDate || '2099-12-31') - new Date(b.dueDate || '2099-12-31');
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  const activeDomainMeta = DOMAINS[activeDomain] || null;

  const renderCustomDomainMetric = (item) => {
    if (item.domain === 'projects' && item.projectMetrics) {
      return (
        <div className="text-[11px] font-mono text-blue-300/90 flex items-center gap-1.5 truncate">
          <GitBranch className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate">{item.projectMetrics.repoUrl || 'repo-main'}</span>
          <span className="text-[10px] bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800/40 text-blue-400 shrink-0">
            {item.projectMetrics.completionIndex}%
          </span>
        </div>
      );
    }

    if (item.domain === 'academic' && item.academicMetrics) {
      return (
        <div className="text-[11px] font-mono text-emerald-300/90 flex items-center gap-1.5 truncate">
          <BookOpen className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate">{item.academicMetrics.publicationTarget || 'Journal Review'}</span>
          {item.academicMetrics.citations?.length > 0 && (
            <span className="text-[10px] bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/40 text-emerald-400 shrink-0">
              {item.academicMetrics.citations.length} Citations
            </span>
          )}
        </div>
      );
    }

    if (item.domain === 'events' && item.eventMetrics) {
      return (
        <div className="text-[11px] font-mono text-amber-300/90 flex items-center gap-1.5 truncate">
          <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="truncate">{item.eventMetrics.eventType || 'Milestone'}</span>
        </div>
      );
    }

    if (item.domain === 'teams' && item.teamMetrics) {
      return (
        <div className="text-[11px] font-mono text-purple-300/90 flex items-center gap-1.5 truncate">
          <Zap className="w-3 h-3 text-purple-400 shrink-0" />
          <span className="truncate">{item.teamMetrics.throughputVelocity || 'Velocity'}</span>
        </div>
      );
    }

    if (item.domain === 'other' && item.otherMetrics) {
      return (
        <div className="text-[11px] font-mono text-zinc-300/90 flex items-center gap-1.5 truncate">
          <ShieldCheck className="w-3 h-3 text-zinc-400 shrink-0" />
          <span className="truncate">{item.otherMetrics.complianceId || 'Compliance'}</span>
        </div>
      );
    }

    return <span className="text-gray-500 text-xs">-</span>;
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto animate-in-fade">
      {/* Domain Isolation Banner Header */}
      {activeDomainMeta && (
        <div 
          className="p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
          style={{ 
            backgroundColor: `${activeDomainMeta.color}08`, 
            borderColor: `${activeDomainMeta.color}35` 
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="p-2 sm:p-2.5 rounded-lg shrink-0"
              style={{ backgroundColor: `${activeDomainMeta.color}20`, border: `1px solid ${activeDomainMeta.color}40` }}
            >
              {React.createElement(domainIconMap[activeDomainMeta.id] || FileText, {
                className: 'w-4 h-4 sm:w-5 sm:h-5',
                style: { color: activeDomainMeta.color }
              })}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">{activeDomainMeta.name}</h2>
                <span 
                  className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold"
                  style={{ backgroundColor: `${activeDomainMeta.color}20`, color: activeDomainMeta.color }}
                >
                  {filteredItems.length} Active Nodes
                </span>
              </div>
              <p className="text-xs text-gray-400 hidden sm:block">{activeDomainMeta.description}</p>
            </div>
          </div>

          <button
            onClick={() => setActiveDomain('all')}
            className="text-xs text-gray-400 hover:text-white bg-zinc-900 border border-zinc-700 px-3 py-1.5 rounded-md self-start sm:self-auto transition-colors"
          >
            Show All Domains
          </button>
        </div>
      )}

      {/* Data Stack Container */}
      <div className="bg-[#151516] border border-[#262626] rounded-xl overflow-hidden shadow-2xl">
        {/* Table Summary Bar */}
        <div className="p-3 bg-[#111112] border-b border-[#262626] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2 font-mono">
            <span>Showing <strong className="text-white">{filteredItems.length}</strong> nodes</span>
            {searchQuery && (
              <span className="text-[#5E6AD2] hidden sm:inline">matching "{searchQuery}"</span>
            )}
          </div>
          <div className="text-[11px] text-gray-400">
            Tap row for Side Drawer
          </div>
        </div>

        {/* 1. DESKTOP DENSE TABLE VIEW (Hidden on Mobile < md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#262626] bg-[#18181A] text-[11px] font-semibold text-gray-400 uppercase tracking-wider select-none">
                <th className="py-2.5 px-3 w-28">Identifier</th>
                <th className="py-2.5 px-3 w-36">Domain</th>
                <th className="py-2.5 px-3 min-w-[260px]">Subject Title</th>
                <th className="py-2.5 px-3 w-28">Status</th>
                <th className="py-2.5 px-3 w-28">Priority</th>
                <th className="py-2.5 px-3 w-36">Assigned Entity</th>
                <th className="py-2.5 px-3 min-w-[180px]">Custom Metrics</th>
                <th className="py-2.5 px-3 w-28 text-right">Target Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222226] text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400 text-xs bg-[#151516]">
                    No tracking items found matching your current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const dom = DOMAINS[item.domain] || DOMAINS.other;
                  const statusMeta = STATUSES[item.status] || STATUSES.todo;
                  const priorityMeta = PRIORITIES[item.priority] || PRIORITIES.none;
                  const isSelected = selectedItemId === item.id;
                  const DomainIcon = domainIconMap[item.domain] || FileText;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => openItemDetails(item.id)}
                      className={`cursor-pointer transition-colors duration-150 group hover:bg-[#1E1E23] ${
                        isSelected ? 'bg-[#22222B] border-l-4 border-l-[#5E6AD2]' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-gray-200 group-hover:text-[#5E6AD2] transition-colors">
                        <span 
                          className="px-2 py-0.5 rounded text-[10px]"
                          style={{ backgroundColor: `${dom.color}15`, color: dom.color, border: `1px solid ${dom.color}30` }}
                        >
                          {getShortId(item.id, item.domain)}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${dom.badgeClass}`}>
                          <DomainIcon className="w-3 h-3" />
                          <span>{dom.name}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-white group-hover:text-indigo-200 transition-colors line-clamp-1">
                          {item.title}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${statusMeta.badgeBg} ${statusMeta.badgeText}`}>
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${priorityMeta.badgeBg} ${priorityMeta.badgeText}`}>
                          {item.priority === 'urgent' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                          {priorityMeta.label}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {item.assignee ? (
                          <div className="flex items-center gap-2">
                            {item.assignee.avatar ? (
                              <img 
                                src={item.assignee.avatar} 
                                alt={item.assignee.name || 'Assignee'} 
                                className="w-5 h-5 rounded-full object-cover border border-[#262626]"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-[#5E6AD2]/20 text-[#5E6AD2] flex items-center justify-center text-[9px] font-bold">
                                {item.assignee.name?.[0]?.toUpperCase() || 'U'}
                              </div>
                            )}
                            <span className="text-gray-300 text-[11px] truncate max-w-[90px]">
                              {item.assignee.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs font-mono">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {renderCustomDomainMetric(item)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-[11px] text-gray-400">
                        {item.dueDate ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {item.dueDate.split('T')[0]}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 2. MOBILE CARD STACK VIEW (Visible on Mobile < md) */}
        <div className="block md:hidden divide-y divide-[#222226]">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              No tracking items found matching your current filter criteria.
            </div>
          ) : (
            filteredItems.map(item => {
              const dom = DOMAINS[item.domain] || DOMAINS.other;
              const statusMeta = STATUSES[item.status] || STATUSES.todo;
              const priorityMeta = PRIORITIES[item.priority] || PRIORITIES.none;
              const isSelected = selectedItemId === item.id;
              const DomainIcon = domainIconMap[item.domain] || FileText;

              return (
                <div
                  key={item.id}
                  onClick={() => openItemDetails(item.id)}
                  className={`p-3.5 space-y-2.5 active:bg-[#1E1E23] transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#22222B] border-l-4 border-l-[#5E6AD2]' : ''
                  }`}
                >
                  {/* Top Row: Identifier + Domain Pill + Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span 
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0"
                        style={{ backgroundColor: `${dom.color}20`, color: dom.color, border: `1px solid ${dom.color}40` }}
                      >
                        {getShortId(item.id, item.domain)}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${dom.badgeClass} truncate`}>
                        <DomainIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{dom.name}</span>
                      </span>
                    </div>

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold shrink-0 ${statusMeta.badgeBg} ${statusMeta.badgeText}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Title */}
                  <div className="font-semibold text-white text-xs leading-snug">
                    {item.title}
                  </div>

                  {/* Custom Domain Metric Mobile Excerpt */}
                  <div className="bg-[#1A1A1E] p-2 rounded border border-[#262626]">
                    {renderCustomDomainMetric(item)}
                  </div>

                  {/* Footer Row: Priority + Assignee + Due Date */}
                  <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                    <span className={`inline-flex items-center gap-1 font-medium ${priorityMeta.badgeText}`}>
                      {item.priority === 'urgent' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                      {priorityMeta.label}
                    </span>

                    <div className="flex items-center gap-3">
                      {item.assignee && (
                        <div className="flex items-center gap-1">
                          {item.assignee.avatar ? (
                            <img 
                              src={item.assignee.avatar} 
                              alt={item.assignee.name || 'Assignee'}
                              className="w-4 h-4 rounded-full object-cover" 
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-[#5E6AD2]/20 text-[#5E6AD2] flex items-center justify-center text-[8px] font-bold">
                              {item.assignee.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                          )}
                          <span className="text-gray-300 text-[10px]">{item.assignee.name.split(' ')[0]}</span>
                        </div>
                      )}

                      {item.dueDate && (
                        <span className="font-mono text-[10px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {item.dueDate.split('T')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
