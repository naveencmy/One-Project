import React, { useMemo, useState } from "react";
import { BarChart3, Calendar, ChevronRight, Maximize2, Filter, ZoomIn } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { DOMAINS, STATUSES } from "../../types/schema";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateShort(date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addWeeks(date, n) {
  return addDays(date, n * 7);
}

// ── Zoom level configurations ─────────────────────────────────────────────────
const ZOOM_CONFIGS = {
  day: {
    label: 'Day',
    paddingBefore: 3,
    paddingAfter: 14,
    defaultRange: { before: 7, after: 14 },
    getMarkers: (rangeStart, rangeEnd) => {
      const markers = [];
      const cursor = new Date(rangeStart);
      while (cursor <= rangeEnd) {
        const dayOffset = Math.floor((cursor - rangeStart) / (1000 * 60 * 60 * 24));
        markers.push({
          date: new Date(cursor),
          dayOffset,
          label: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getDate()}`,
          sublabel: DAY_NAMES[cursor.getDay()],
          isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      return markers;
    },
    minWidth: 1200,
  },
  week: {
    label: 'Week',
    paddingBefore: 7,
    paddingAfter: 21,
    defaultRange: { before: 14, after: 42 },
    getMarkers: (rangeStart, rangeEnd) => {
      const markers = [];
      // Start from previous Monday
      const cursor = new Date(rangeStart);
      const day = cursor.getDay();
      cursor.setDate(cursor.getDate() - (day === 0 ? 6 : day - 1));
      while (cursor <= rangeEnd) {
        const dayOffset = Math.floor((cursor - rangeStart) / (1000 * 60 * 60 * 24));
        if (dayOffset >= 0) {
          markers.push({
            date: new Date(cursor),
            dayOffset,
            label: `W${getWeekNumber(cursor)}`,
            sublabel: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getDate()}`,
          });
        }
        cursor.setDate(cursor.getDate() + 7);
      }
      return markers;
    },
    minWidth: 800,
  },
  month: {
    label: 'Month',
    paddingBefore: 3,
    paddingAfter: 5,
    defaultRange: { before: 7, after: 30 },
    getMarkers: (rangeStart, rangeEnd) => {
      const markers = [];
      const cursor = new Date(rangeStart);
      cursor.setDate(1);
      while (cursor <= rangeEnd) {
        const dayOffset = Math.floor((cursor - rangeStart) / (1000 * 60 * 60 * 24));
        if (dayOffset >= 0) {
          markers.push({
            date: new Date(cursor),
            dayOffset,
            label: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`,
            sublabel: `${MONTH_NAMES[cursor.getMonth()].slice(0,3)} '${String(cursor.getFullYear()).slice(2)}`,
          });
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return markers;
    },
    minWidth: 680,
  },
};

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ── GanttChart Component ──────────────────────────────────────────────────────
export const GanttChart = ({ showFullscreenButton = true, zoomLevel: externalZoom, onZoomChange }) => {
  const { items, openItemDetails, setCurrentView } = useWorkspace();
  const [hoveredId, setHoveredId]       = useState(null);
  const [filterDomain, setFilterDomain] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [internalZoom, setInternalZoom] = useState("month");

  // Support both controlled (external) and uncontrolled zoom
  const zoomLevel = externalZoom || internalZoom;
  const setZoom = onZoomChange || setInternalZoom;

  const zoomConfig = ZOOM_CONFIGS[zoomLevel] || ZOOM_CONFIGS.month;

  const ganttItems = useMemo(() => {
    return items
      .filter(item => item.createdAt && item.dueDate)
      .filter(item => filterDomain === "all" || item.domain === filterDomain)
      .filter(item => filterStatus === "all" || item.status === filterStatus)
      .map(item => ({
        ...item,
        startDate: parseDate(item.createdAt),
        endDate:   parseDate(item.dueDate),
      }))
      .filter(item => item.startDate && item.endDate && item.endDate >= item.startDate)
      .sort((a, b) => a.startDate - b.startDate);
  }, [items, filterDomain, filterStatus]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    const cfg = zoomConfig;
    if (ganttItems.length === 0) {
      return {
        rangeStart: addDays(today, -cfg.defaultRange.before),
        rangeEnd:   addDays(today,  cfg.defaultRange.after),
        totalDays:  cfg.defaultRange.before + cfg.defaultRange.after,
      };
    }
    const minStart = new Date(Math.min(...ganttItems.map(i => i.startDate)));
    const maxEnd   = new Date(Math.max(...ganttItems.map(i => i.endDate)));
    const rs = addDays(minStart, -cfg.paddingBefore);
    const re = addDays(maxEnd,    cfg.paddingAfter);
    const days = Math.ceil((re - rs) / (1000 * 60 * 60 * 24));
    return { rangeStart: rs, rangeEnd: re, totalDays: days };
  }, [ganttItems, today, zoomConfig]);

  const markers = useMemo(
    () => zoomConfig.getMarkers(rangeStart, rangeEnd),
    [rangeStart, rangeEnd, zoomConfig]
  );

  const todayPct = useMemo(() => {
    const offset = Math.floor((today - rangeStart) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(100, (offset / totalDays) * 100));
  }, [today, rangeStart, totalDays]);

  const getBarPct = (item) => {
    const startOffset = Math.max(0, Math.floor((item.startDate - rangeStart) / (1000 * 60 * 60 * 24)));
    const endOffset   = Math.min(totalDays, Math.ceil((item.endDate - rangeStart) / (1000 * 60 * 60 * 24)));
    const left  = (startOffset / totalDays) * 100;
    const width = Math.max(1.5, ((endOffset - startOffset) / totalDays) * 100);
    return { left, width };
  };

  const isOverdue = (item) => item.endDate < today && item.status !== "done";
  const isActive  = (item) => item.startDate <= today && item.endDate >= today;

  return (
    <div className="bg-[#151516] border border-[#262626] rounded-xl shadow-lg overflow-hidden flex flex-col">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-5 border-b border-[#222226]">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            Project Gantt Timeline
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {ganttItems.length} scheduled items across {zoomConfig.label.toLowerCase()} view
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Zoom Tabs */}
          <div
            className="flex items-center gap-0.5 bg-[#1A1A1E] border border-[#2B2B32] rounded-lg p-0.5"
            role="group"
            aria-label="Timeline zoom level"
          >
            {Object.entries(ZOOM_CONFIGS).map(([key, cfg]) => (
              <button
                key={key}
                id={`gantt-zoom-${key}`}
                onClick={() => setZoom(key)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 ${
                  zoomLevel === key
                    ? 'bg-[#5E6AD2] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          {/* Domain Filter */}
          <div className="flex items-center gap-1.5 bg-[#1E1E22] border border-[#2B2B32] rounded-lg px-2 py-1 text-xs">
            <Filter className="w-3 h-3 text-gray-400" />
            <select
              id="gantt-filter-domain"
              value={filterDomain}
              onChange={e => setFilterDomain(e.target.value)}
              className="bg-transparent text-gray-300 font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-[#151516]">All Domains</option>
              {Object.values(DOMAINS).map(d => (
                <option key={d.id} value={d.id} className="bg-[#151516]">{d.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-[#1E1E22] border border-[#2B2B32] rounded-lg px-2 py-1 text-xs">
            <select
              id="gantt-filter-status"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-transparent text-gray-300 font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-[#151516]">All Statuses</option>
              {Object.values(STATUSES).map(s => (
                <option key={s.id} value={s.id} className="bg-[#151516]">{s.label}</option>
              ))}
            </select>
          </div>

          {showFullscreenButton && (
            <button
              id="gantt-fullscreen-btn"
              onClick={() => setCurrentView('gantt')}
              className="bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20 border border-[#5E6AD2]/30 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
              title="Open full-page Gantt view"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Fullscreen</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Timeline Canvas — scoped overflow so scrollbar stays inside card ── */}
      <div className="overflow-x-auto overflow-y-hidden">
        <div style={{ minWidth: `${zoomConfig.minWidth}px` }} className="p-5 pt-3">

          {/* Top tick labels */}
          <div className="relative h-8 mb-1 border-b border-[#262626]">
            {markers.map((m, idx) => (
              <div
                key={idx}
                className="absolute top-0 flex flex-col items-start"
                style={{ left: `${(m.dayOffset / totalDays) * 100}%` }}
              >
                <div className="h-3 w-px bg-[#333338]" />
                <span className="ml-1 text-[10px] font-mono text-gray-400 whitespace-nowrap leading-tight">
                  {m.label}
                </span>
                {m.sublabel && (
                  <span className="ml-1 text-[9px] font-mono text-gray-600 whitespace-nowrap">
                    {m.sublabel}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Item rows — vertical scroll if many items */}
          <div
            className="space-y-1.5 relative overflow-y-auto"
            style={{ maxHeight: '420px' }}
          >
            {ganttItems.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center gap-2 text-gray-600">
                <Calendar className="w-8 h-8 opacity-30" />
                <p className="text-xs">No items with start & due dates found.</p>
              </div>
            ) : (
              ganttItems.map(item => {
                const dom    = DOMAINS[item.domain] || DOMAINS.other;
                const status = STATUSES[item.status] || STATUSES.todo;
                const { left, width } = getBarPct(item);
                const overdue  = isOverdue(item);
                const active   = isActive(item);
                const done     = item.status === "done";
                const isHovered = hoveredId === item.id;
                const barColor  = done ? "#10B981" : overdue ? "#EF4444" : active ? dom.color : `${dom.color}99`;

                return (
                  <div
                    key={item.id}
                    className="relative h-9 flex items-center group"
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Row background */}
                    <div className="absolute inset-0 rounded bg-[#1A1A1E] border border-[#262626] group-hover:border-[#333338] transition-colors" />

                    {/* Today marker */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-amber-400/70 z-20 pointer-events-none"
                      style={{ left: `${todayPct}%` }}
                    />

                    {/* Duration bar */}
                    <div
                      className="absolute h-5 rounded-md cursor-pointer z-10 transition-all duration-200 flex items-center overflow-hidden"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: barColor,
                        boxShadow: isHovered ? `0 0 10px ${barColor}60` : 'none',
                      }}
                      onClick={() => openItemDetails(item.id)}
                      title={item.title}
                    >
                      <span className="px-2 text-[10px] font-semibold text-white truncate whitespace-nowrap leading-none">
                        {width > 8 ? item.title : ''}
                      </span>
                    </div>

                    {/* ID badge */}
                    {left > 8 && (
                      <div className="absolute left-1 top-0 bottom-0 flex items-center z-30 pointer-events-none">
                        <span
                          className="text-[9px] font-mono font-semibold px-1 py-0.5 rounded"
                          style={{ color: barColor, backgroundColor: `${barColor}15` }}
                        >
                          {item.id}
                        </span>
                      </div>
                    )}

                    {/* Hover tooltip */}
                    {isHovered && (
                      <div
                        className="absolute z-50 bottom-full mb-2 bg-[#0F0F11] border border-[#333340] rounded-lg shadow-2xl p-3 w-64 pointer-events-none"
                        style={{ left: `${Math.min(left, 60)}%` }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span
                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                            style={{ color: dom.color, backgroundColor: `${dom.color}20`, border: `1px solid ${dom.color}40` }}
                          >
                            {item.id}
                          </span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${status.badgeBg} ${status.badgeText}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-white mb-1 leading-tight">{item.title}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDateShort(item.startDate)} → {formatDateShort(item.endDate)}</span>
                        </div>
                        {item.assignee && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <img
                              src={item.assignee.avatar}
                              alt={item.assignee.name}
                              className="w-4 h-4 rounded-full object-cover"
                            />
                            <span className="text-[10px] text-gray-300">{item.assignee.name}</span>
                          </div>
                        )}
                        {overdue && <div className="mt-1.5 text-[10px] text-rose-400 font-semibold">⚠ Overdue</div>}
                        <div className="mt-2 pt-1.5 border-t border-[#262626] text-[10px] text-indigo-400 flex items-center gap-1">
                          Click to open details <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom axis */}
          <div className="relative h-6 mt-2 border-t border-[#262626]">
            {markers.map((m, idx) => (
              <div key={idx} className="absolute top-1" style={{ left: `${(m.dayOffset / totalDays) * 100}%` }}>
                <span className="text-[10px] font-mono text-gray-600 whitespace-nowrap">
                  {m.sublabel || m.label}
                </span>
              </div>
            ))}
            <div className="absolute top-1 -translate-x-1/2" style={{ left: `${todayPct}%` }}>
              <span className="text-[10px] font-mono text-amber-400 font-semibold whitespace-nowrap">Today</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
