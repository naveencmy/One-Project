import React, { useState } from 'react';
import { X, Plus, FolderGit2, BookOpen, Calendar, Users, FileText, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DOMAINS, PRIORITIES, STATUSES } from '../../types/schema';

export const CreateTaskModal = () => {
  const { isCreateModalOpen, setIsCreateModalOpen, addItem, assigneesList } = useWorkspace();

  const [domain, setDomain] = useState('projects');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('todo');
  const [assigneeName, setAssigneeName] = useState(assigneesList[0]?.name || '');
  const [dueDate, setDueDate] = useState('2026-09-01');
  const [tagsInput, setTagsInput] = useState('Engineering, Sprint24');
  const [description, setDescription] = useState('');

  // Domain specific metrics states
  const [repoUrl, setRepoUrl] = useState('github.com/nexus-org/core-engine');
  const [targetRelease, setTargetRelease] = useState('v2.4.0');
  const [paperTitle, setPaperTitle] = useState('Pareto Frontiers in Vision Transformers');
  const [publicationTarget, setPublicationTarget] = useState('IEEE ICSE 2026');
  const [eventType, setEventType] = useState('Technical Milestone');
  const [locationCoordinates, setLocationCoordinates] = useState('Zoom / Main Hall');
  const [throughputVelocity, setThroughputVelocity] = useState('45 pts / sprint');
  const [complianceId, setComplianceId] = useState('ISO-27001-SEC');

  if (!isCreateModalOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedAssignee = assigneesList.find(a => a.name === assigneeName) || assigneesList[0] || { name: assigneeName };
    const tagsArray = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    const newItemData = {
      domain,
      title: title.trim(),
      priority,
      status,
      assignee: selectedAssignee,
      dueDate,
      tags: tagsArray,
      description: description.trim()
    };

    // Domain Specific Custom Metrics Injection
    if (domain === 'projects') {
      newItemData.projectMetrics = {
        repoUrl,
        targetRelease,
        completionIndex: 25,
        buildStatus: 'passing'
      };
    } else if (domain === 'academic') {
      newItemData.academicMetrics = {
        paperTitle,
        publicationTarget,
        citations: ['doi:10.1145/3610548'],
        advisorFeedback: 'Initial draft under advisor review.',
        gradingScale: 'Target: Grade A / 4.0 GPA'
      };
    } else if (domain === 'events') {
      newItemData.eventMetrics = {
        eventType,
        locationCoordinates,
        eventTimestamp: `${dueDate}T10:00:00Z`,
        attendeeRegistry: ['Elena Vance', selectedAssignee.name]
      };
    } else if (domain === 'teams') {
      newItemData.teamMetrics = {
        teamName: title,
        throughputVelocity,
        allocatedNodes: 5,
        members: [selectedAssignee.name]
      };
    } else if (domain === 'other') {
      newItemData.otherMetrics = {
        complianceId,
        category: 'Compliance & Legal'
      };
    }

    addItem(newItemData);
    setIsCreateModalOpen(false);

    // Reset Form
    setTitle('');
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setIsCreateModalOpen(false)}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl bg-[#151516] border border-[#262626] rounded-xl shadow-2xl z-10 overflow-hidden text-gray-200 animate-in-fade">
        
        {/* Header */}
        <div className="p-4 border-b border-[#262626] bg-[#111112] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#5E6AD2]/20 border border-[#5E6AD2]/40 text-[#6E7BE2]">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create New Tracking Node</h3>
              <p className="text-xs text-gray-400">Instantly initialize a task across any operational domain</p>
            </div>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(false)}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          
          {/* Domain Picker Pills */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
              Select Operational Domain
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {Object.values(DOMAINS).map(dom => {
                const isSelected = domain === dom.id;
                return (
                  <button
                    key={dom.id}
                    type="button"
                    onClick={() => setDomain(dom.id)}
                    className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                      isSelected
                        ? `${dom.badgeClass} font-bold shadow-md`
                        : 'border-[#262626] text-gray-400 hover:text-white hover:bg-[#1E1E21]'
                    }`}
                  >
                    <span className="text-[10px] truncate">{dom.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Subject Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Distributed Vector DB Refactor or Dissertation Defense..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#1A1A1E] border border-[#262626] focus:border-[#5E6AD2] rounded-lg px-3 py-2 text-white font-medium focus:outline-none transition-all"
            />
          </div>

          {/* Attributes Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-2 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
              >
                {Object.values(PRIORITIES).map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-2 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
              >
                {Object.values(STATUSES).map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Assignee</label>
              <select
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-2 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
              >
                {assigneesList.map(a => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Target Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-2 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
              />
            </div>
          </div>

          {/* Domain Specific Fields */}
          <div className="bg-[#1A1A1E] p-3 rounded-lg border border-[#262626] space-y-2">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
              {DOMAINS[domain]?.name} Custom Metrics
            </span>

            {domain === 'projects' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Repo URL (github.com/org/repo)"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="bg-[#151516] border border-[#262626] rounded px-2 py-1 text-blue-300 font-mono"
                />
                <input
                  type="text"
                  placeholder="Target Release (v2.4)"
                  value={targetRelease}
                  onChange={(e) => setTargetRelease(e.target.value)}
                  className="bg-[#151516] border border-[#262626] rounded px-2 py-1 text-white font-mono"
                />
              </div>
            )}

            {domain === 'academic' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Paper / Literature Title"
                  value={paperTitle}
                  onChange={(e) => setPaperTitle(e.target.value)}
                  className="bg-[#151516] border border-[#262626] rounded px-2 py-1 text-emerald-300"
                />
                <input
                  type="text"
                  placeholder="Publication Target (IEEE / ACM)"
                  value={publicationTarget}
                  onChange={(e) => setPublicationTarget(e.target.value)}
                  className="bg-[#151516] border border-[#262626] rounded px-2 py-1 text-white"
                />
              </div>
            )}

            {domain === 'events' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Event Type (Defense/Symposium)"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="bg-[#151516] border border-[#262626] rounded px-2 py-1 text-amber-300"
                />
                <input
                  type="text"
                  placeholder="Location / Zoom URL"
                  value={locationCoordinates}
                  onChange={(e) => setLocationCoordinates(e.target.value)}
                  className="bg-[#151516] border border-[#262626] rounded px-2 py-1 text-white"
                />
              </div>
            )}

            {domain === 'teams' && (
              <input
                type="text"
                placeholder="Throughput Velocity (e.g. 45 pts/sprint)"
                value={throughputVelocity}
                onChange={(e) => setThroughputVelocity(e.target.value)}
                className="w-full bg-[#151516] border border-[#262626] rounded px-2 py-1 text-purple-300 font-mono"
              />
            )}

            {domain === 'other' && (
              <input
                type="text"
                placeholder="Compliance ID (e.g. ISO-27001)"
                value={complianceId}
                onChange={(e) => setComplianceId(e.target.value)}
                className="w-full bg-[#151516] border border-[#262626] rounded px-2 py-1 text-zinc-300 font-mono"
              />
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              placeholder="Rust, SIMD, Defense, Audit..."
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white font-mono"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Description Notes</label>
            <textarea
              rows={2}
              placeholder="Context notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#1A1A1E] border border-[#262626] rounded p-2.5 text-white focus:outline-none focus:border-[#5E6AD2]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#262626]">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[#5E6AD2] hover:bg-[#6E7BE2] text-white font-semibold px-4 py-2 rounded-lg shadow-lg shadow-[#5E6AD2]/20 transition-all"
            >
              Create Node
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
