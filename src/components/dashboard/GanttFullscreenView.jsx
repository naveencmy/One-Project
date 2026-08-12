import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  BarChart3, ArrowLeft, Calendar, CheckCircle2, AlertTriangle,
  Maximize2, Minimize2, GripVertical, Clock, Layers,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DOMAINS, STATUSES } from '../../types/schema';
import { GanttChart } from './GanttChart';

// ── Mini Node List Panel ──────────────────────────────────────────────────────
const NodeListPanel = ({ items, onSelect, style }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div
      className="flex flex-col border-r border-[#222226] bg-[#111113] overflow-hidden"
      style={style}
    >
      <div className="px-4 py-3 border-b border-[#1E1E22]">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-violet-400" />
          Timeline Nodes
          <span className="ml-auto text-[10px] font-mono text-gray-500">{items.filter(i => i.createdAt && i.dueDate).length} scheduled</span>
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {items
          .filter(i => i.createdAt && i.dueDate)
          .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
          .map(item => {
            const dom    = DOMAINS[item.domain] || DOMAINS.other;
            const status = STATUSES[item.status] || STATUSES.todo;
            const dueDate = new Date(item.dueDate);
            const isOverdue = dueDate < today && item.status !== 'done';
            const isDone    = item.status === 'done';

            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className="w-full text-left px-4 py-2.5 border-b border-[#1A1A1E] hover:bg-[#1A1A22] transition-colors group"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: dom.color }}
                  />
                  <span className="text-[10px] font-mono text-gray-500 shrink-0">{item.id}</span>
                  <span
                    className={`ml-auto text-[9px] font-mono px-1 py-0.5 rounded shrink-0 ${status.badgeBg} ${status.badgeText}`}
                  >
                    {status.label}
                  </span>
                </div>
                <p className="text-xs text-gray-200 font-medium leading-tight truncate group-hover:text-white">
                  {item.title}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {isOverdue ? (
                    <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  ) : (
                    <Clock className="w-2.5 h-2.5 text-gray-500" />
                  )}
                  <span className={`text-[9px] font-mono ${isOverdue ? 'text-rose-400' : 'text-gray-500'}`}>
                    Due {item.dueDate}
                  </span>
                </div>
              </button>
            );
          })}
        {items.filter(i => i.createdAt && i.dueDate).length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-600">
            <Calendar className="w-6 h-6 opacity-30" />
            <p className="text-xs">No scheduled items</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main GanttFullscreenView ──────────────────────────────────────────────────
export const GanttFullscreenView = () => {
  const { items, setCurrentView, openItemDetails } = useWorkspace();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel]       = useState('month');
  const [splitPct, setSplitPct]         = useState(22); // left panel width %
  const [isDragging, setIsDragging]     = useState(false);
  const containerRef = useRef(null);
  const dragStartX   = useRef(0);
  const dragStartPct = useRef(0);

  const metrics = useMemo(() => {
    const total        = items.length;
    const scheduled    = items.filter(i => i.createdAt && i.dueDate).length;
    const completed    = items.filter(i => i.status === 'done').length;
    const inProgress   = items.filter(i => i.status === 'in_progress').length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = items.filter(i => {
      if (i.status === 'done' || !i.dueDate) return false;
      return new Date(i.dueDate) < today;
    }).length;
    return { total, scheduled, completed, inProgress, overdue };
  }, [items]);

  // ── Split-pane drag logic ─────────────────────────────────────────────────
  const onDragStart = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current   = e.clientX;
    dragStartPct.current = splitPct;
  }, [splitPct]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      if (!containerRef.current) return;
      const containerW = containerRef.current.offsetWidth;
      const dx = e.clientX - dragStartX.current;
      const newPct = Math.max(12, Math.min(40, dragStartPct.current + (dx / containerW) * 100));
      setSplitPct(newPct);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging]);

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-[100] bg-[#0B0B0C] flex flex-col overflow-hidden'
    : 'flex flex-col min-h-screen bg-[#0B0B0C]';

  return (
    <div className={containerClass}>
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-5 py-4 border-b border-[#262626] shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => setCurrentView('overview')}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Overview Hub</span>
            </button>
            <span className="text-gray-600">•</span>
            <span className="text-xs font-mono text-indigo-400">Visual Timeline</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            Full Workspace Gantt
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Metric badges */}
          {[
            { label: 'Scheduled', value: `${metrics.scheduled}/${metrics.total}`, color: 'text-white' },
            { label: 'In Progress', value: metrics.inProgress, color: 'text-blue-400' },
            { label: 'Completed', value: metrics.completed, color: 'text-emerald-400' },
          ].map(m => (
            <div key={m.label} className="bg-[#151516] border border-[#262626] rounded-xl px-3 py-2 text-center min-w-[80px]">
              <div className="text-[10px] text-gray-400 font-semibold uppercase">{m.label}</div>
              <div className={`text-lg font-bold font-mono ${m.color}`}>{m.value}</div>
            </div>
          ))}
          {metrics.overdue > 0 && (
            <div className="bg-rose-950/40 border border-rose-800/40 rounded-xl px-3 py-2 text-center min-w-[80px]">
              <div className="text-[10px] text-rose-400 font-semibold uppercase">Overdue</div>
              <div className="text-lg font-bold text-rose-400 font-mono">{metrics.overdue}</div>
            </div>
          )}

          {/* Fullscreen toggle */}
          <button
            id="gantt-fullscreen-toggle"
            onClick={() => setIsFullscreen(f => !f)}
            className={`p-2 rounded-xl border transition-all ${
              isFullscreen
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'bg-[#151516] border-[#262626] text-gray-400 hover:text-white hover:border-[#444]'
            }`}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Split-Pane Body ──────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex flex-1 overflow-hidden"
        style={{ cursor: isDragging ? 'col-resize' : 'default' }}
      >
        {/* Left: Node list panel */}
        <NodeListPanel
          items={items}
          onSelect={openItemDetails}
          style={{ width: `${splitPct}%`, minWidth: 160, maxWidth: '40%' }}
        />

        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className={`w-4 shrink-0 flex items-center justify-center cursor-col-resize z-10 group transition-colors ${
            isDragging ? 'bg-indigo-500/10' : 'hover:bg-[#1E1E28]'
          }`}
          title="Drag to resize panels"
          aria-label="Resize panels"
        >
          <div className={`h-12 flex flex-col justify-center gap-0.5 transition-opacity ${isDragging ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}>
            <GripVertical className="w-3 h-8 text-gray-500" />
          </div>
        </div>

        {/* Right: Gantt chart panel */}
        <div
          className="flex-1 overflow-hidden flex flex-col p-4 gap-4"
          style={{ minWidth: 0 }}
        >
          {/* Chart with scoped scrollbar */}
          <div className="flex-1 overflow-hidden">
            <GanttChart
              showFullscreenButton={false}
              zoomLevel={zoomLevel}
              onZoomChange={setZoomLevel}
            />
          </div>

          {/* Domain breakdown row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 shrink-0">
            {Object.values(DOMAINS).map(dom => {
              const domainItems    = items.filter(i => i.domain === dom.id);
              const scheduledCount = domainItems.filter(i => i.createdAt && i.dueDate).length;
              return (
                <div
                  key={dom.id}
                  className="bg-[#151516] border border-[#262626] rounded-xl p-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dom.color }} />
                    <span className="text-[11px] text-gray-200 font-medium truncate">{dom.name}</span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-gray-500 shrink-0 ml-1">
                    {scheduledCount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
