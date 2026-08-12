import React from 'react';
import { 
  FolderGit2, 
  BookOpen, 
  Calendar, 
  Users, 
  FileText, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Activity,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DOMAINS, PRIORITIES, STATUSES } from '../../types/schema';
import { GanttChart } from './GanttChart';

export const OverviewHub = () => {
  const { 
    items, 
    setActiveDomain, 
    setCurrentView, 
    openItemDetails 
  } = useWorkspace();

  // Metrics computation per domain
  const getDomainMetrics = (domainKey) => {
    const domainItems = items.filter(i => i.domain === domainKey);
    const total = domainItems.length;
    const completed = domainItems.filter(i => i.status === 'done').length;
    const inProgress = domainItems.filter(i => i.status === 'in_progress').length;
    const urgent = domainItems.filter(i => i.priority === 'urgent' && i.status !== 'done').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, urgent, completionRate };
  };

  const domainIconMap = {
    projects: FolderGit2,
    academic: BookOpen,
    events: Calendar,
    teams: Users,
    other: FileText
  };

  // Distribution chart computation
  const totalItemsCount = items.length || 1;
  const distribution = Object.keys(DOMAINS).map(key => {
    const count = items.filter(i => i.domain === key).length;
    const percentage = Math.round((count / totalItemsCount) * 100);
    return {
      domain: DOMAINS[key],
      count,
      percentage
    };
  });

  // Urgent Action Queue Items
  const urgentQueueItems = items
    .filter(i => (i.priority === 'urgent' || i.priority === 'high') && i.status !== 'done')
    .sort((a, b) => {
      const priorityRank = { urgent: 2, high: 1 };
      return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
    });

  // Recent Activity Feed compilation
  const recentActivities = items
    .flatMap(item => (item.activity || []).map(act => ({ ...act, itemTitle: item.title, itemId: item.id, itemDomain: item.domain })))
    .slice(0, 5);

  const handleDomainCardClick = (domainId) => {
    setActiveDomain(domainId);
    setCurrentView('issues');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-in-fade">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl border border-[#262626] bg-gradient-to-r from-[#151516] via-[#1A1A22] to-[#151516] p-6 shadow-xl">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-[#5E6AD2]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5E6AD2]">Unified Workspace Command</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Engineering, Research & Operations Hub
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-2xl">
              Real-time synchronization across {items.length} active tracking nodes. Click any domain block below to dive into its dense data stack.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('issues')}
              className="bg-[#5E6AD2] hover:bg-[#6E7BE2] text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-[#5E6AD2]/20 transition-all active:scale-[0.98]"
            >
              <span>Explore Data Stack</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 1. Quick-Glance Metric Visualization Blocks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Domain Node Metrics
          </h2>
          <span className="text-xs text-gray-400">Click card to isolate</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {Object.values(DOMAINS).map(dom => {
            const Icon = domainIconMap[dom.id] || FileText;
            const metrics = getDomainMetrics(dom.id);

            return (
              <div
                key={dom.id}
                onClick={() => handleDomainCardClick(dom.id)}
                className="bg-[#151516] border border-[#262626] hover:border-[#5E6AD2]/50 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl group relative overflow-hidden"
              >
                <div 
                  className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity"
                  style={{ backgroundColor: dom.color }}
                />

                <div className="flex items-center justify-between mb-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${dom.color}18`, border: `1px solid ${dom.color}30` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: dom.color }} />
                  </div>
                  <span 
                    className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${dom.color}15`, color: dom.color, border: `1px solid ${dom.color}30` }}
                  >
                    {metrics.completionRate}% Done
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-bold text-white font-mono tracking-tight">
                    {metrics.total}
                  </div>
                  <div className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors truncate">
                    {dom.name}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#222226] flex items-center justify-between text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {metrics.inProgress} Active
                  </span>
                  {metrics.urgent > 0 ? (
                    <span className="text-rose-400 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {metrics.urgent} Urgent
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-medium">Nominal</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Global Visual Domain Composition Distribution Chart */}
      <div className="bg-[#151516] border border-[#262626] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Global Domain Composition
            </h3>
            <p className="text-xs text-gray-400">Proportional breakdown of tracking nodes across active operational domains</p>
          </div>
          <span className="text-xs font-mono text-indigo-300 bg-[#5E6AD2]/10 border border-[#5E6AD2]/30 px-2.5 py-1 rounded-md self-start">
            Total Nodes: {items.length}
          </span>
        </div>

        {/* Multi-Segment Composition Bar */}
        <div className="h-4 w-full bg-zinc-900 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-[#262626]">
          {distribution.map(item => (
            item.percentage > 0 && (
              <div
                key={item.domain.id}
                style={{ width: `${item.percentage}%`, backgroundColor: item.domain.color }}
                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500 hover:opacity-80 relative group"
                title={`${item.domain.name}: ${item.count} items (${item.percentage}%)`}
              />
            )
          ))}
        </div>

        {/* Legend Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-3 border-t border-[#222226]">
          {distribution.map(item => (
            <div 
              key={item.domain.id}
              onClick={() => handleDomainCardClick(item.domain.id)}
              className="flex items-center justify-between p-2 rounded-lg bg-[#1E1E21]/50 border border-[#262626] hover:border-[#5E6AD2]/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.domain.color }} />
                <span className="text-xs text-gray-300 truncate">{item.domain.name}</span>
              </div>
              <div className="text-xs font-mono font-bold text-white shrink-0 ml-1">
                {item.percentage}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Gantt Timeline Chart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            Schedule & Timeline
          </h2>
        </div>
        <GanttChart />
      </div>

      {/* 4. Urgent Action Queue & Activity Stream Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent Action Queue (2 Columns wide) */}
        <div className="lg:col-span-2 bg-[#151516] border border-[#262626] rounded-xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-rose-500/10 border border-rose-500/30">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Urgent Action Queue</h3>
                <p className="text-xs text-gray-400">High-priority non-completed tasks across all domains</p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/40">
              {urgentQueueItems.length} Urgent Items
            </span>
          </div>

          <div className="space-y-2.5 flex-1">
            {urgentQueueItems.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500 bg-[#1E1E21]/30 rounded-lg border border-dashed border-[#262626]">
                No urgent pending items. All operational queues nominal.
              </div>
            ) : (
              urgentQueueItems.slice(0, 5).map(item => {
                const dom = DOMAINS[item.domain] || DOMAINS.other;
                const statusMeta = STATUSES[item.status] || STATUSES.todo;
                const priorityMeta = PRIORITIES[item.priority] || PRIORITIES.high;

                return (
                  <div
                    key={item.id}
                    onClick={() => openItemDetails(item.id)}
                    className="p-3 bg-[#1A1A1E] border border-[#262626] hover:border-[#5E6AD2] rounded-lg cursor-pointer transition-all duration-150 flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span 
                        className="text-[10px] font-mono px-2 py-0.5 rounded shrink-0 font-semibold"
                        style={{ backgroundColor: `${dom.color}20`, color: dom.color, border: `1px solid ${dom.color}40` }}
                      >
                        {item.id}
                      </span>

                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white group-hover:text-indigo-300 transition-colors truncate">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                            {priorityMeta.label}
                          </span>
                          <span>•</span>
                          <span>{dom.name}</span>
                          {item.dueDate && (
                            <>
                              <span>•</span>
                              <span className="text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {item.dueDate}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {item.assignee && (
                        <img
                          src={item.assignee.avatar}
                          alt={item.assignee.name}
                          className="w-6 h-6 rounded-full object-cover border border-[#262626]"
                          title={`Assigned to ${item.assignee.name}`}
                        />
                      )}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${statusMeta.badgeBg} ${statusMeta.badgeText}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity Stream (1 Column wide) */}
        <div className="bg-[#151516] border border-[#262626] rounded-xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Live Activity Stream</h3>
            </div>
            <span className="text-[10px] font-mono text-gray-400">Real-time</span>
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 max-h-[340px] pr-1">
            {recentActivities.map((act, index) => {
              const dom = DOMAINS[act.itemDomain] || DOMAINS.other;
              return (
                <div 
                  key={act.id || index}
                  onClick={() => openItemDetails(act.itemId)}
                  className="p-2.5 rounded-lg bg-[#1E1E21]/60 border border-[#262626] hover:border-[#5E6AD2]/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-gray-200">{act.user}</span>
                    <span className="text-gray-500 font-mono text-[10px]">{act.time}</span>
                  </div>
                  <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                    "{act.text}"
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                    <span className="font-mono text-gray-400">{act.itemId}</span>
                    <span className="text-gray-600">•</span>
                    <span style={{ color: dom.color }}>{dom.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
