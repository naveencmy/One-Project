import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Briefcase, 
  Building, 
  Palette, 
  Check, 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Save, 
  ShieldCheck, 
  X,
  FileSpreadsheet,
  Database,
  Lock,
  KeyRound,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

import { fetchExcelSheetsFromApi } from '../../api/client';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80'
];

const ACCENT_PRESETS = [
  { name: 'Royal Indigo', color: '#5E6AD2' },
  { name: 'Emerald Green', color: '#10B981' },
  { name: 'Cobalt Blue', color: '#3B82F6' },
  { name: 'Amber Gold', color: '#F59E0B' },
  { name: 'Deep Purple', color: '#8B5CF6' }
];

const SettingsInnerContent = () => {
  const { 
    userProfile, 
    updateUserProfile, 
    assigneesList, 
    addAssignee, 
    updateAssignee, 
    deleteAssignee,
    backendConnected,
    lockPin,
    downloadExcelFile
  } = useWorkspace();

  // Excel Multi-Sheet Inspector State
  const [excelSheets, setExcelSheets] = useState([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);

  // Local Form States for Profile
  const [name, setName] = useState(userProfile.name);
  const [email, setEmail] = useState(userProfile.email);
  const [role, setRole] = useState(userProfile.role);
  const [department, setDepartment] = useState(userProfile.department);
  const [avatar, setAvatar] = useState(userProfile.avatar);
  const [accentColor, setAccentColor] = useState(userProfile.accentColor || '#5E6AD2');
  const [savedFeedback, setSavedFeedback] = useState(false);

  // New Assignee Modal / Form State
  const [isAddAssigneeModalOpen, setIsAddAssigneeModalOpen] = useState(false);
  const [editingAssigneeOriginalName, setEditingAssigneeOriginalName] = useState(null);
  
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('');
  const [newPersonAvatar, setNewPersonAvatar] = useState(PRESET_AVATARS[0]);

  // Sync local form fields when userProfile is loaded from Go backend / Excel store
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setEmail(userProfile.email || '');
      setRole(userProfile.role || '');
      setDepartment(userProfile.department || '');
      setAvatar(userProfile.avatar || '');
      setAccentColor(userProfile.accentColor || '#5E6AD2');
    }
  }, [userProfile]);

  useEffect(() => {
    let isMounted = true;
    const loadSheets = async () => {
      setIsLoadingSheets(true);
      const data = await fetchExcelSheetsFromApi();
      if (isMounted && data && Array.isArray(data)) {
        setExcelSheets(data);
      }
      if (isMounted) setIsLoadingSheets(false);
    };
    loadSheets();
    return () => { isMounted = false; };
  }, []);

  const handleRefreshSheets = async () => {
    setIsLoadingSheets(true);
    const data = await fetchExcelSheetsFromApi();
    if (data && Array.isArray(data)) setExcelSheets(data);
    setIsLoadingSheets(false);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    updateUserProfile({
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      department: department.trim(),
      avatar: avatar.trim(),
      accentColor
    });

    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleOpenAddModal = () => {
    setEditingAssigneeOriginalName(null);
    setNewPersonName('');
    setNewPersonEmail('');
    setNewPersonRole('');
    setNewPersonAvatar(PRESET_AVATARS[0]);
    setIsAddAssigneeModalOpen(true);
  };

  const handleOpenEditModal = (person) => {
    setEditingAssigneeOriginalName(person.name);
    setNewPersonName(person.name);
    setNewPersonEmail(person.email);
    setNewPersonRole(person.role);
    setNewPersonAvatar(person.avatar);
    setIsAddAssigneeModalOpen(true);
  };

  const handleSaveAssignee = (e) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;

    const personObj = {
      name: newPersonName.trim(),
      email: newPersonEmail.trim() || 'member@nexus.io',
      role: newPersonRole.trim() || 'Collaborator',
      avatar: newPersonAvatar.trim() || PRESET_AVATARS[0]
    };

    if (editingAssigneeOriginalName) {
      updateAssignee(editingAssigneeOriginalName, personObj);
    } else {
      addAssignee(personObj);
    }

    setIsAddAssigneeModalOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto animate-in-fade text-gray-200">
      
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <User className="w-6 h-6 text-[#5E6AD2]" />
            Workspace & Profile Settings
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Manage your personal profile, workspace preferences, inner Excel multi-sheet engine, and PIN protection layer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => lockPin()}
            className="bg-[#2A1A1A] hover:bg-rose-950/60 border border-rose-800/40 text-rose-400 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
            title="Lock profile settings immediately"
          >
            <Lock className="w-3.5 h-3.5" /> Lock Profile Now
          </button>
          {savedFeedback && (
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 bg-emerald-950/60 border border-emerald-800/50 px-3 py-1.5 rounded-lg animate-in-fade">
              <Check className="w-4 h-4" /> Profile Updated!
            </span>
          )}
        </div>
      </div>

      {/* 1. Multi-Sheet Storage Engine Metadata Section */}
      <div className="bg-[#151516] border border-[#262626] rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Inner Multi-Sheet Storage Architecture (<code className="text-indigo-400 font-mono">workspace_data.xlsx</code>)
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Real-time Go Excel backend managing distinct inner worksheets for core records, profiles, and roster data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshSheets}
              className="p-1.5 rounded-lg bg-[#1E1E22] hover:bg-[#2A2A32] text-gray-300 border border-[#262626] transition-colors"
              title="Refresh sheet info"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSheets ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={downloadExcelFile}
              className="bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20 border border-[#5E6AD2]/30 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Download .xlsx
            </button>
          </div>
        </div>

        {/* Sheet Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {excelSheets.length > 0 ? (
            excelSheets.map((sheet) => (
              <div 
                key={sheet.name}
                className="bg-[#1A1A1E] border border-[#262626] rounded-xl p-3.5 flex flex-col justify-between space-y-2 hover:border-[#5E6AD2]/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-indigo-300 bg-[#5E6AD2]/15 px-2 py-0.5 rounded border border-[#5E6AD2]/30">
                    📄 {sheet.name}
                  </span>
                  <span className="text-[10px] font-mono bg-zinc-800 text-gray-400 px-2 py-0.5 rounded-full">
                    {sheet.rowCount} rows · {sheet.columnCount} cols
                  </span>
                </div>

                <p className="text-[11px] text-gray-400 leading-relaxed">
                  {sheet.purpose}
                </p>

                <div className="pt-2 border-t border-[#262626] text-[10px] text-gray-500 font-mono truncate">
                  Headers: {sheet.headers ? sheet.headers.slice(0, 4).join(', ') + (sheet.headers.length > 4 ? '...' : '') : 'N/A'}
                </div>
              </div>
            ))
          ) : (
            <>
              {/* Static Sheet Cards fallback if backend loading */}
              <div className="bg-[#1A1A1E] border border-[#262626] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-indigo-300 bg-[#5E6AD2]/15 px-2 py-0.5 rounded border border-[#5E6AD2]/30">
                    📄 TrackingNodes
                  </span>
                  <span className="text-[10px] font-mono bg-zinc-800 text-gray-400 px-2 py-0.5 rounded-full">
                    Primary Data Sheet
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Stores primary tracking nodes, domain metrics, priority indices, tags & activity logs.
                </p>
              </div>

              <div className="bg-[#1A1A1E] border border-[#262626] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded border border-[#10B981]/30">
                    📄 ProfileData
                  </span>
                  <span className="text-[10px] font-mono bg-zinc-800 text-gray-400 px-2 py-0.5 rounded-full">
                    Inner Protection Sheet
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Stores admin user credentials, workspace preferences & SHA-256 PIN hash (Default PIN: <span className="text-amber-300 font-bold">3040</span>).
                </p>
              </div>

              <div className="bg-[#1A1A1E] border border-[#262626] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30">
                    📄 TeamRoster
                  </span>
                  <span className="text-[10px] font-mono bg-zinc-800 text-gray-400 px-2 py-0.5 rounded-full">
                    Assignees Roster Sheet
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Stores collaborative team member attributes, roles, emails & avatar links.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Grid Layout: Profile Settings & Team Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Edit User Profile */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveProfile} className="bg-[#151516] border border-[#262626] rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#262626]">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Personal Profile Details
              </h2>
            </div>

            {/* Avatar Preview & Selector */}
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-2">Profile Avatar</label>
              <div className="flex flex-wrap items-center gap-4">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Avatar Preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#5E6AD2] shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#5E6AD2]/20 border-2 border-[#5E6AD2]/40 flex items-center justify-center shadow-md">
                    <span className="text-2xl font-bold text-indigo-300">?</span>
                  </div>
                )}
                
                <div className="flex-1 min-w-[200px] space-y-2">
                  <div className="flex items-center gap-2">
                    {PRESET_AVATARS.map((preset, idx) => (
                      <img
                        key={idx}
                        src={preset}
                        alt={`Preset ${idx}`}
                        onClick={() => setAvatar(preset)}
                        className={`w-8 h-8 rounded-full object-cover cursor-pointer transition-all border-2 ${
                          avatar === preset ? 'border-[#5E6AD2] scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>

                  <input
                    type="url"
                    placeholder="Or paste custom image URL..."
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
              </div>
            </div>

            {/* Name & Role Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Job Title / Role</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
              </div>
            </div>

            {/* Email & Department Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Department / Lab</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
              </div>
            </div>

            {/* Workspace Theme Accent Color */}
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-2 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-indigo-400" />
                Workspace Accent Color Theme
              </label>
              <div className="flex items-center gap-3">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => setAccentColor(preset.color)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                      accentColor === preset.color
                        ? 'border-white text-white font-semibold shadow-md'
                        : 'border-[#262626] text-gray-400 hover:text-white'
                    }`}
                    style={{ backgroundColor: `${preset.color}15` }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3 border-t border-[#262626] flex items-center justify-end">
              <button
                type="submit"
                className="bg-[#5E6AD2] hover:bg-[#6E7BE2] text-white font-semibold text-xs px-5 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-[#5E6AD2]/20 transition-all active:scale-[0.98]"
              >
                <Save className="w-4 h-4" /> Save Profile Changes
              </button>
            </div>
          </form>
        </div>

        {/* Right 1 Column: Manage Team Members & Assignees Roster */}
        <div className="space-y-6">
          <div className="bg-[#151516] border border-[#262626] rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Team Members Roster
                </h2>
              </div>

              <button
                onClick={handleOpenAddModal}
                className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Person
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Manage collaborators stored in the <code className="text-emerald-400 font-mono">TeamRoster</code> sheet.
            </p>

            {/* Roster List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {assigneesList.map((person) => (
                <div 
                  key={person.name}
                  className="p-2.5 bg-[#1A1A1E] border border-[#262626] rounded-lg flex items-center justify-between gap-3 group hover:border-[#5E6AD2]/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img 
                      src={person.avatar} 
                      alt={person.name} 
                      className="w-8 h-8 rounded-full object-cover border border-[#262626]"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{person.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{person.role}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={() => handleOpenEditModal(person)}
                      className="p-1 rounded text-gray-400 hover:text-white hover:bg-zinc-800"
                      title="Edit Profile"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {assigneesList.length > 1 && (
                      <button
                        onClick={() => deleteAssignee(person.name)}
                        className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-950/40"
                        title="Remove Person"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Add / Edit Team Person Profile Modal */}
      {isAddAssigneeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsAddAssigneeModalOpen(false)}
          />

          <div className="relative w-full max-w-md bg-[#151516] border border-[#262626] rounded-xl shadow-2xl z-10 overflow-hidden text-gray-200 animate-in-fade">
            <div className="p-4 border-b border-[#262626] bg-[#111112] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {editingAssigneeOriginalName ? 'Edit Team Member Profile' : 'Add New Team Member'}
              </h3>
              <button onClick={() => setIsAddAssigneeModalOpen(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignee} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Dr. Aris Thorne"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Role / Job Title</label>
                <input
                  type="text"
                  placeholder="Principal Investigator / Security Lead"
                  value={newPersonRole}
                  onChange={(e) => setNewPersonRole(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="athorne@stanford.edu"
                  value={newPersonEmail}
                  onChange={(e) => setNewPersonEmail(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Avatar Image URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newPersonAvatar}
                  onChange={(e) => setNewPersonAvatar(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2] mb-2"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">Presets:</span>
                  {PRESET_AVATARS.map((preset, idx) => (
                    <img
                      key={idx}
                      src={preset}
                      alt={`Preset ${idx}`}
                      onClick={() => setNewPersonAvatar(preset)}
                      className="w-6 h-6 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform border border-[#262626]"
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsAddAssigneeModalOpen(false)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#5E6AD2] hover:bg-[#6E7BE2] text-white px-4 py-1.5 rounded-md font-semibold"
                >
                  Save Person Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const SettingsView = () => (
  <SettingsInnerContent />
);

export const SettingsViewWrapped = SettingsView;
