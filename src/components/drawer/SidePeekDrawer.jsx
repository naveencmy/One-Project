import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Clock, 
  User, 
  Tag, 
  FolderGit2, 
  BookOpen, 
  Calendar, 
  Users, 
  FileText, 
  GitBranch, 
  MapPin, 
  ShieldAlert, 
  Zap, 
  Plus, 
  MessageSquare, 
  Send,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Award
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DOMAINS, PRIORITIES, STATUSES } from '../../types/schema';
import { getShortId } from '../../utils/formatters';

export const SidePeekDrawer = () => {
  const { 
    selectedItem, 
    isDrawerOpen, 
    closeItemDetails, 
    updateItem, 
    deleteItem,
    addComment,
    assigneesList
  } = useWorkspace();

  const [commentText, setCommentText] = useState('');
  const [newCitationInput, setNewCitationInput] = useState('');
  const [newAttendeeInput, setNewAttendeeInput] = useState('');

  // Live ticking countdown timer state for events
  const [countdownString, setCountdownString] = useState('');

  useEffect(() => {
    if (!selectedItem || selectedItem.domain !== 'events' || !selectedItem.eventMetrics?.eventTimestamp) {
      setCountdownString('');
      return;
    }

    const updateTimer = () => {
      const targetTime = new Date(selectedItem.eventMetrics.eventTimestamp).getTime();
      const now = new Date().getTime();
      const diff = targetTime - now;

      if (diff <= 0) {
        setCountdownString('Event Milestone Reached / In Progress');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdownString(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [selectedItem]);

  if (!isDrawerOpen || !selectedItem) return null;

  const currentDom = DOMAINS[selectedItem.domain] || DOMAINS.other;

  // Handlers for Reactive Patching
  const handleFieldChange = (field, value) => {
    updateItem(selectedItem.id, { [field]: value });
  };

  const handleNestedMetricChange = (domainMetricKey, field, value) => {
    const existing = selectedItem[domainMetricKey] || {};
    updateItem(selectedItem.id, {
      [domainMetricKey]: {
        ...existing,
        [field]: value
      }
    });
  };

  const handlePostComment = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment(selectedItem.id, commentText);
    setCommentText('');
  };

  const handleAddCitation = () => {
    if (!newCitationInput.trim()) return;
    const existingCitations = selectedItem.academicMetrics?.citations || [];
    handleNestedMetricChange('academicMetrics', 'citations', [...existingCitations, newCitationInput.trim()]);
    setNewCitationInput('');
  };

  const handleRemoveCitation = (index) => {
    const existingCitations = selectedItem.academicMetrics?.citations || [];
    const updated = existingCitations.filter((_, i) => i !== index);
    handleNestedMetricChange('academicMetrics', 'citations', updated);
  };

  const handleAddAttendee = () => {
    if (!newAttendeeInput.trim()) return;
    const existingRegistry = selectedItem.eventMetrics?.attendeeRegistry || [];
    handleNestedMetricChange('eventMetrics', 'attendeeRegistry', [...existingRegistry, newAttendeeInput.trim()]);
    setNewAttendeeInput('');
  };

  const handleRemoveAttendee = (index) => {
    const existingRegistry = selectedItem.eventMetrics?.attendeeRegistry || [];
    const updated = existingRegistry.filter((_, i) => i !== index);
    handleNestedMetricChange('eventMetrics', 'attendeeRegistry', updated);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={closeItemDetails}
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-2xl h-full bg-[#151516] border-l border-[#262626] shadow-2xl flex flex-col z-10 animate-slide-right text-gray-200">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#262626] bg-[#111112] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span 
              className="text-xs font-mono font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: `${currentDom.color}20`, color: currentDom.color, border: `1px solid ${currentDom.color}40` }}
            >
              {getShortId(selectedItem.id, selectedItem.domain)}
            </span>

            {/* Domain Badge */}
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${currentDom.badgeClass}`}>
              {currentDom.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => deleteItem(selectedItem.id)}
              className="p-1.5 rounded-md text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
              title="Delete Task Node"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={closeItemDetails}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Editable Title */}
          <div>
            <label htmlFor="drawer-item-title" className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Title
            </label>
            <input
              id="drawer-item-title"
              name="title"
              type="text"
              value={selectedItem.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className="w-full text-base font-bold text-white bg-[#1A1A1E] border border-[#262626] focus:border-[#5E6AD2] rounded-lg px-3 py-2 focus:outline-none transition-all"
            />
          </div>

          {/* Quick Context Attributes Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#1A1A1E] p-3 rounded-xl border border-[#262626]">
            
            {/* Status Dropdown */}
            <div>
              <label htmlFor="drawer-item-status" className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Status</label>
              <select
                id="drawer-item-status"
                name="status"
                value={selectedItem.status}
                onChange={(e) => handleFieldChange('status', e.target.value)}
                className="w-full bg-[#151516] border border-[#262626] text-xs text-white rounded px-2 py-1 focus:outline-none focus:border-[#5E6AD2]"
              >
                {Object.values(STATUSES).map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Priority Dropdown */}
            <div>
              <label htmlFor="drawer-item-priority" className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Priority</label>
              <select
                id="drawer-item-priority"
                name="priority"
                value={selectedItem.priority}
                onChange={(e) => handleFieldChange('priority', e.target.value)}
                className="w-full bg-[#151516] border border-[#262626] text-xs text-white rounded px-2 py-1 focus:outline-none focus:border-[#5E6AD2]"
              >
                {Object.values(PRIORITIES).map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Assignee Entity Dropdown */}
            <div>
              <label htmlFor="drawer-item-assignee" className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Assignee</label>
              <select
                id="drawer-item-assignee"
                name="assignee"
                value={selectedItem.assignee?.name || ''}
                onChange={(e) => {
                  const found = assigneesList.find(a => a.name === e.target.value);
                  handleFieldChange('assignee', found || null);
                }}
                className="w-full bg-[#151516] border border-[#262626] text-xs text-white rounded px-2 py-1 focus:outline-none focus:border-[#5E6AD2]"
              >
                <option value="">Unassigned</option>
                {assigneesList.map(a => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Due Date Picker */}
            <div>
              <label htmlFor="drawer-item-due-date" className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Target Date</label>
              <input
                id="drawer-item-due-date"
                name="due_date"
                type="date"
                value={selectedItem.dueDate?.split('T')[0] || ''}
                onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                className="w-full bg-[#151516] border border-[#262626] text-xs text-white rounded px-2 py-1 focus:outline-none focus:border-[#5E6AD2]"
              />
            </div>
          </div>

          {/* DYNAMIC DOMAIN-SPECIFIC METRIC EDITORS */}
          <div className="bg-[#1A1A1E] p-4 rounded-xl border border-[#262626] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#262626]">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentDom.color }} />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {currentDom.name} Domain Schema & Metrics
              </h4>
            </div>

            {/* 1. PROJECTS METRICS */}
            {selectedItem.domain === 'projects' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Code Repository Anchor</label>
                    <input
                      type="text"
                      value={selectedItem.projectMetrics?.repoUrl || ''}
                      onChange={(e) => handleNestedMetricChange('projectMetrics', 'repoUrl', e.target.value)}
                      placeholder="github.com/org/repo"
                      className="w-full bg-[#151516] border border-[#262626] rounded px-2.5 py-1.5 text-blue-300 font-mono focus:outline-none focus:border-[#5E6AD2]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Target Release Window</label>
                    <input
                      type="text"
                      value={selectedItem.projectMetrics?.targetRelease || ''}
                      onChange={(e) => handleNestedMetricChange('projectMetrics', 'targetRelease', e.target.value)}
                      placeholder="v2.4.0-RC1"
                      className="w-full bg-[#151516] border border-[#262626] rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#5E6AD2]"
                    />
                  </div>
                </div>

                {/* Completion Index Slider */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-gray-400">Completion Index</span>
                    <span className="font-mono text-blue-400 font-bold">{selectedItem.projectMetrics?.completionIndex || 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedItem.projectMetrics?.completionIndex || 0}
                    onChange={(e) => handleNestedMetricChange('projectMetrics', 'completionIndex', parseInt(e.target.value))}
                    className="w-full accent-[#5E6AD2]"
                  />
                </div>
              </div>
            )}

            {/* 2. ACADEMIC WORKS METRICS */}
            {selectedItem.domain === 'academic' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Publication Target</label>
                    <input
                      type="text"
                      value={selectedItem.academicMetrics?.publicationTarget || ''}
                      onChange={(e) => handleNestedMetricChange('academicMetrics', 'publicationTarget', e.target.value)}
                      placeholder="IEEE ICSE 2026"
                      className="w-full bg-[#151516] border border-[#262626] rounded px-2.5 py-1.5 text-emerald-300 font-mono focus:outline-none focus:border-[#5E6AD2]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Grading Scale / Criteria</label>
                    <input
                      type="text"
                      value={selectedItem.academicMetrics?.gradingScale || ''}
                      onChange={(e) => handleNestedMetricChange('academicMetrics', 'gradingScale', e.target.value)}
                      placeholder="Target A / 4.0 GPA"
                      className="w-full bg-[#151516] border border-[#262626] rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Advisor Feedback Node</label>
                  <textarea
                    rows={2}
                    value={selectedItem.academicMetrics?.advisorFeedback || ''}
                    onChange={(e) => handleNestedMetricChange('academicMetrics', 'advisorFeedback', e.target.value)}
                    placeholder="Enter notes or feedback from thesis advisor..."
                    className="w-full bg-[#151516] border border-[#262626] rounded px-2.5 py-1.5 text-gray-300 focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>

                {/* Citations Manager */}
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Citations & Reference Links</label>
                  <div className="space-y-1.5 mb-2">
                    {(selectedItem.academicMetrics?.citations || []).map((cite, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-[#151516] px-2.5 py-1.5 rounded border border-[#262626]">
                        <span className="font-mono text-emerald-400 text-[11px] truncate">{cite}</span>
                        <button
                          onClick={() => handleRemoveCitation(idx)}
                          className="text-gray-500 hover:text-rose-400 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCitationInput}
                      onChange={(e) => setNewCitationInput(e.target.value)}
                      placeholder="Add DOI or paper link (e.g. doi:10.1145/...)"
                      className="flex-1 bg-[#151516] border border-[#262626] rounded px-2.5 py-1 text-xs focus:outline-none focus:border-[#5E6AD2]"
                    />
                    <button
                      onClick={handleAddCitation}
                      className="bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1 rounded text-xs flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. EVENTS METRICS */}
            {selectedItem.domain === 'events' && (
              <div className="space-y-3 text-xs">
                {/* Live Countdown Display */}
                {countdownString && (
                  <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-300">
                      <Clock className="w-4 h-4 animate-pulse" />
                      <span className="text-xs font-semibold">Live Event Countdown:</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-amber-400">{countdownString}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Event Type</label>
                    <input
                      type="text"
                      value={selectedItem.eventMetrics?.eventType || ''}
                      onChange={(e) => handleNestedMetricChange('eventMetrics', 'eventType', e.target.value)}
                      placeholder="Dissertation Defense, Symposium..."
                      className="w-full bg-[#151516] border border-[#262626] rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Location Coordinates</label>
                    <input
                      type="text"
                      value={selectedItem.eventMetrics?.locationCoordinates || ''}
                      onChange={(e) => handleNestedMetricChange('eventMetrics', 'locationCoordinates', e.target.value)}
                      placeholder="Bldg 4 Room 302 or Zoom URL"
                      className="w-full bg-[#151516] border border-[#262626] rounded px-2.5 py-1.5 text-amber-300 focus:outline-none focus:border-[#5E6AD2]"
                    />
                  </div>
                </div>

                {/* Attendee Registry */}
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Attendee Registry</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(selectedItem.eventMetrics?.attendeeRegistry || []).map((att, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 bg-[#151516] text-amber-300 border border-amber-800/30 px-2 py-0.5 rounded text-[11px]">
                        <span>{att}</span>
                        <button onClick={() => handleRemoveAttendee(idx)} className="hover:text-rose-400">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newAttendeeInput}
                      onChange={(e) => setNewAttendeeInput(e.target.value)}
                      placeholder="Add attendee name..."
                      className="flex-1 bg-[#151516] border border-[#262626] rounded px-2.5 py-1 text-xs focus:outline-none focus:border-[#5E6AD2]"
                    />
                    <button
                      onClick={handleAddAttendee}
                      className="bg-amber-700 hover:bg-amber-600 text-white px-2.5 py-1 rounded text-xs flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. TEAMS METRICS */}
            {selectedItem.domain === 'teams' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Throughput Velocity Tracking</label>
                    <input
                      type="text"
                      value={selectedItem.teamMetrics?.throughputVelocity || ''}
                      onChange={(e) => handleNestedMetricChange('teamMetrics', 'throughputVelocity', e.target.value)}
                      placeholder="48 pts / sprint"
                      className="w-full bg-[#151516] border border-[#262626] rounded px-2.5 py-1.5 text-purple-300 font-mono focus:outline-none focus:border-[#5E6AD2]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Node Allocations Count</label>
                    <input
                      type="number"
                      value={selectedItem.teamMetrics?.allocatedNodes || 0}
                      onChange={(e) => handleNestedMetricChange('teamMetrics', 'allocatedNodes', parseInt(e.target.value) || 0)}
                      className="w-full bg-[#151516] border border-[#262626] rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#5E6AD2]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5. OTHER METRICS */}
            {selectedItem.domain === 'other' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Compliance ID / Ref</label>
                    <input
                      type="text"
                      value={selectedItem.otherMetrics?.complianceId || ''}
                      onChange={(e) => handleNestedMetricChange('otherMetrics', 'complianceId', e.target.value)}
                      placeholder="ISO-27001-Sec4"
                      className="w-full bg-[#151516] border border-[#262626] rounded px-2.5 py-1.5 text-zinc-300 font-mono focus:outline-none focus:border-[#5E6AD2]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Category</label>
                    <input
                      type="text"
                      value={selectedItem.otherMetrics?.category || ''}
                      onChange={(e) => handleNestedMetricChange('otherMetrics', 'category', e.target.value)}
                      placeholder="Licensing, Legal, Quick Capture..."
                      className="w-full bg-[#151516] border border-[#262626] rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description & Contextual Notes */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Description & Specification Notes
            </label>
            <textarea
              rows={4}
              value={selectedItem.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Add markdown or engineering specifications..."
              className="w-full bg-[#1A1A1E] border border-[#262626] focus:border-[#5E6AD2] text-xs text-gray-200 rounded-lg p-3 focus:outline-none transition-all leading-relaxed"
            />
          </div>

          {/* Activity Stream & Comment Posting */}
          <div className="pt-4 border-t border-[#262626]">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Activity Feed ({selectedItem.activity?.length || 0})
            </h4>

            {/* Comment Box */}
            <form onSubmit={handlePostComment} className="mb-4 flex items-center gap-2">
              <input
                type="text"
                placeholder="Post comment or status log update..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-[#1A1A1E] border border-[#262626] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#5E6AD2]"
              />
              <button
                type="submit"
                className="bg-[#5E6AD2] hover:bg-[#6E7BE2] text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" /> Post
              </button>
            </form>

            {/* Activity Stream List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(selectedItem.activity || []).map((act, index) => (
                <div key={act.id || index} className="p-2.5 bg-[#1A1A1E] border border-[#262626] rounded-lg text-xs">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-indigo-300">{act.user}</span>
                    <span className="text-gray-500 font-mono text-[10px]">{act.time}</span>
                  </div>
                  <p className="text-gray-300">{act.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
