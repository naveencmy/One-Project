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
  Lock,
  KeyRound,
  RefreshCw,
  Crown,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { fetchExcelSheetsFromApi } from '../../api/client';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80',
];

const ACCENT_PRESETS = [
  { name: 'Royal Indigo', color: '#5E6AD2' },
  { name: 'Emerald Green', color: '#10B981' },
  { name: 'Cobalt Blue', color: '#3B82F6' },
  { name: 'Amber Gold', color: '#F59E0B' },
  { name: 'Deep Purple', color: '#8B5CF6' },
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
    downloadExcelFile,
    isTeamLead,
    activeProfileId,
    activeName,
    allProfiles,
    createMemberProfile,
    deleteMemberProfile,
    refreshProfileList,
    setMemberPin,
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

  // Team member management (Team Lead only)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMemberProfile, setEditingMemberProfile] = useState(null); // existing allProfiles item
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [memberDept, setMemberDept] = useState('');
  const [memberAvatar, setMemberAvatar] = useState(PRESET_AVATARS[0]);
  const [memberAccent, setMemberAccent] = useState('#5E6AD2');
  const [memberPinInput, setMemberPinInput] = useState('');
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState('');

  // Legacy Assignee Modal
  const [isAddAssigneeModalOpen, setIsAddAssigneeModalOpen] = useState(false);
  const [editingAssigneeOriginalName, setEditingAssigneeOriginalName] = useState(null);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('');
  const [newPersonAvatar, setNewPersonAvatar] = useState(PRESET_AVATARS[0]);

  // Sync local form fields when userProfile is loaded from backend
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
      if (isMounted && data && Array.isArray(data)) setExcelSheets(data);
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
      accentColor,
    });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  // ── Member Management (Team Lead only) ──────────────────────────────────────
  const openNewMemberModal = () => {
    setEditingMemberProfile(null);
    setMemberName(''); setMemberEmail(''); setMemberRole('');
    setMemberDept(''); setMemberAvatar(PRESET_AVATARS[0]);
    setMemberAccent('#5E6AD2'); setMemberPinInput('');
    setMemberError('');
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (profile) => {
    setEditingMemberProfile(profile);
    setMemberName(profile.name || '');
    setMemberEmail(''); // email not in safe list
    setMemberRole(profile.role || '');
    setMemberDept(profile.department || '');
    setMemberAvatar(profile.avatar || PRESET_AVATARS[0]);
    setMemberAccent(profile.accentColor || '#5E6AD2');
    setMemberPinInput('');
    setMemberError('');
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    if (!memberName.trim()) { setMemberError('Name is required'); return; }
    setMemberSaving(true);
    setMemberError('');
    try {
      if (editingMemberProfile) {
        // Edit existing profile
        const { updateProfileByIdApi } = await import('../../api/client');
        await updateProfileByIdApi(editingMemberProfile.profile_id, {
          name: memberName.trim(),
          role: memberRole.trim(),
          email: memberEmail.trim(),
          department: memberDept.trim(),
          avatar: memberAvatar.trim(),
          accentColor: memberAccent,
        });
        // If PIN entered, set it too
        if (memberPinInput.length === 4) {
          const hash = await sha256(memberPinInput);
          await setMemberPin(editingMemberProfile.profile_id, hash);
        }
      } else {
        // Create new profile
        const data = {
          name: memberName.trim(),
          role: memberRole.trim() || 'Member',
          email: memberEmail.trim(),
          department: memberDept.trim(),
          avatar: memberAvatar.trim(),
          accentColor: memberAccent,
        };
        // If PIN provided, set it in the creation data
        if (memberPinInput.length === 4) {
          const hash = await sha256(memberPinInput);
          data.pin_hash = hash;
        }
        await createMemberProfile(data);
      }
      await refreshProfileList();
      setIsMemberModalOpen(false);
    } catch (err) {
      setMemberError(err.message || 'Failed to save profile');
    }
    setMemberSaving(false);
  };

  const handleDeleteMember = async (profileId, name) => {
    if (!window.confirm(`Remove profile for "${name}"? This cannot be undone.`)) return;
    try {
      await deleteMemberProfile(profileId);
    } catch (err) {
      alert(err.message || 'Failed to delete profile');
    }
  };

  // ── Legacy Assignee Modal ────────────────────────────────────────────────────
  const handleOpenAddModal = () => {
    setEditingAssigneeOriginalName(null);
    setNewPersonName(''); setNewPersonEmail(''); setNewPersonRole('');
    setNewPersonAvatar(PRESET_AVATARS[0]);
    setIsAddAssigneeModalOpen(true);
  };

  const handleOpenEditModal = (person) => {
    setEditingAssigneeOriginalName(person.name);
    setNewPersonName(person.name); setNewPersonEmail(person.email);
    setNewPersonRole(person.role); setNewPersonAvatar(person.avatar);
    setIsAddAssigneeModalOpen(true);
  };

  const handleSaveAssignee = (e) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    const personObj = {
      name: newPersonName.trim(),
      email: newPersonEmail.trim() || 'member@nexus.io',
      role: newPersonRole.trim() || 'Collaborator',
      avatar: newPersonAvatar.trim() || PRESET_AVATARS[0],
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
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <User className="w-6 h-6 text-[#5E6AD2]" />
            Workspace & Profile Settings
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            {isTeamLead
              ? 'Team Lead: Full access — manage all profiles, team roster, and workspace settings.'
              : `Logged in as ${activeName || userProfile.name || 'Member'} — you can edit your own profile.`
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isTeamLead && (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-amber-950/40 border-amber-700/40 text-amber-400">
              <Crown className="w-3 h-3" /> Team Lead
            </span>
          )}
          <button
            onClick={() => lockPin()}
            className="bg-[#2A1A1A] hover:bg-rose-950/60 border border-rose-800/40 text-rose-400 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
            title="Lock profile settings immediately"
          >
            <Lock className="w-3.5 h-3.5" /> Lock & Switch User
          </button>
          {savedFeedback && (
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 bg-emerald-950/60 border border-emerald-800/50 px-3 py-1.5 rounded-lg animate-in-fade">
              <Check className="w-4 h-4" /> Profile Updated!
            </span>
          )}
        </div>
      </div>

      {/* Excel Multi-Sheet Inspector */}
      <div className="bg-[#151516] border border-[#262626] rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Inner Multi-Sheet Storage Architecture (<code className="text-indigo-400 font-mono">workspace_data.xlsx</code>)
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Real-time Go Excel backend managing distinct inner worksheets.
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
                <p className="text-[11px] text-gray-400 leading-relaxed">{sheet.purpose}</p>
                <div className="pt-2 border-t border-[#262626] text-[10px] text-gray-500 font-mono truncate">
                  Headers: {sheet.headers ? sheet.headers.slice(0, 4).join(', ') + (sheet.headers.length > 4 ? '...' : '') : 'N/A'}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center text-xs text-gray-500 py-6">
              {isLoadingSheets ? 'Loading sheets...' : 'No sheet data. Click refresh to load.'}
            </div>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: My Profile */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveProfile} className="bg-[#151516] border border-[#262626] rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#262626]">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                My Profile
              </h2>
              {!isTeamLead && (
                <span className="ml-auto text-[10px] text-gray-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  Only your own profile is editable
                </span>
              )}
            </div>

            {/* Avatar Preview & Selector */}
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-2">Profile Avatar</label>
              <div className="flex flex-wrap items-center gap-4">
                {avatar ? (
                  <img src={avatar} alt="Avatar Preview" className="w-16 h-16 rounded-full object-cover border-2 border-[#5E6AD2] shadow-md" />
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
                        className={`w-8 h-8 rounded-full object-cover cursor-pointer transition-all border-2 ${avatar === preset ? 'border-[#5E6AD2] scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
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

            {/* Name & Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Job Title / Role
                  {!isTeamLead && <span className="ml-1 text-gray-500 text-[10px]">(read-only)</span>}
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" required value={role} onChange={(e) => setRole(e.target.value)}
                    disabled={!isTeamLead}
                    className={`w-full bg-[#1A1A1E] border border-[#262626] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#5E6AD2] ${!isTeamLead ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            </div>

            {/* Email & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Department / Lab</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
              </div>
            </div>

            {/* Accent Color */}
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-2 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-indigo-400" />
                Workspace Accent Color Theme
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => setAccentColor(preset.color)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                      accentColor === preset.color ? 'border-white text-white font-semibold shadow-md' : 'border-[#262626] text-gray-400 hover:text-white'
                    }`}
                    style={{ backgroundColor: `${preset.color}15` }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="pt-3 border-t border-[#262626] flex items-center justify-end">
              <button
                type="submit"
                className="bg-[#5E6AD2] hover:bg-[#6E7BE2] text-white font-semibold text-xs px-5 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-[#5E6AD2]/20 transition-all active:scale-[0.98]"
              >
                <Save className="w-4 h-4" /> Save My Profile
              </button>
            </div>
          </form>
        </div>

        {/* Right: Team Members / Profile Management */}
        <div className="space-y-6">

          {/* ── Team Lead: Manage All Profiles ────────────────────────────── */}
          {isTeamLead ? (
            <div className="bg-[#151516] border border-[#262626] rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Team Profiles
                  </h2>
                </div>
                <button
                  onClick={openNewMemberModal}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Profile
                </button>
              </div>

              <p className="text-xs text-gray-400">
                Manage all user profiles stored in <code className="text-amber-400 font-mono">profile_data.xlsx</code>. Only Team Lead can create, edit or delete profiles.
              </p>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {allProfiles.map((profile) => {
                  const isOwnProfile = profile.profile_id === activeProfileId;
                  const isLeadProfile = profile.profile_id === 'PROF-001';
                  return (
                    <div
                      key={profile.profile_id}
                      className={`p-2.5 bg-[#1A1A1E] border rounded-lg flex items-center justify-between gap-3 group transition-colors ${
                        isOwnProfile ? 'border-[#5E6AD2]/50' : 'border-[#262626] hover:border-[#5E6AD2]/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {profile.avatar ? (
                          <img src={profile.avatar} alt={profile.name} className="w-8 h-8 rounded-full object-cover border border-[#262626]" />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-[#262626]"
                            style={{ backgroundColor: `${profile.accentColor || '#5E6AD2'}20`, color: profile.accentColor || '#5E6AD2' }}
                          >
                            {(profile.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                            {profile.name || 'Unnamed'}
                            {isOwnProfile && <span className="text-[9px] bg-[#5E6AD2]/20 text-[#5E6AD2] px-1.5 py-0.5 rounded-full border border-[#5E6AD2]/30">You</span>}
                            {isLeadProfile && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: profile.hasPin ? '#10B981' : '#6B7280' }} />
                            {profile.role || 'Member'}
                            {!profile.hasPin && <span className="text-amber-500 text-[9px]"> · No PIN</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={() => openEditMemberModal(profile)}
                          className="p-1 rounded text-gray-400 hover:text-white hover:bg-zinc-800"
                          title="Edit Profile"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {!isLeadProfile && (
                          <button
                            onClick={() => handleDeleteMember(profile.profile_id, profile.name)}
                            className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-950/40"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Non-Lead: Read-only team roster */
            <div className="bg-[#151516] border border-[#262626] rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#262626]">
                <Users className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Team Members</h2>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-950/20 border border-amber-800/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  Only the <strong>Team Lead</strong> can add, edit or remove team profiles. Contact your Team Lead for changes.
                </p>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {allProfiles.map((profile) => {
                  const isOwnProfile = profile.profile_id === activeProfileId;
                  return (
                    <div
                      key={profile.profile_id}
                      className={`p-2.5 bg-[#1A1A1E] border rounded-lg flex items-center gap-2.5 transition-colors ${isOwnProfile ? 'border-[#5E6AD2]/50' : 'border-[#262626]'}`}
                    >
                      {profile.avatar ? (
                        <img src={profile.avatar} alt={profile.name} className="w-8 h-8 rounded-full object-cover border border-[#262626]" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-[#262626]"
                          style={{ backgroundColor: `${profile.accentColor || '#5E6AD2'}20`, color: profile.accentColor || '#5E6AD2' }}
                        >
                          {(profile.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                          {profile.name}
                          {isOwnProfile && <span className="text-[9px] bg-[#5E6AD2]/20 text-[#5E6AD2] px-1.5 py-0.5 rounded-full border border-[#5E6AD2]/30">You</span>}
                        </div>
                        <div className="text-[10px] text-gray-400">{profile.role}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Legacy Assignees (Team Roster) — Team Lead only for editing */}
          <div className="bg-[#151516] border border-[#262626] rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Assignees Roster</h2>
              </div>
              {isTeamLead && (
                <button
                  onClick={handleOpenAddModal}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Assignees stored in <code className="text-emerald-400 font-mono">TeamRoster</code> sheet (used for item assignment).
            </p>
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
              {assigneesList.map((person) => (
                <div
                  key={person.name}
                  className="p-2.5 bg-[#1A1A1E] border border-[#262626] rounded-lg flex items-center justify-between gap-3 group hover:border-[#5E6AD2]/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={person.avatar} alt={person.name} className="w-8 h-8 rounded-full object-cover border border-[#262626]" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{person.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{person.role}</div>
                    </div>
                  </div>
                  {isTeamLead && (
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                      <button onClick={() => handleOpenEditModal(person)} className="p-1 rounded text-gray-400 hover:text-white hover:bg-zinc-800" title="Edit">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {assigneesList.length > 1 && (
                        <button onClick={() => deleteAssignee(person.name)} className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-950/40" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Team Lead: Add/Edit Member Profile Modal ──────────────────────────── */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsMemberModalOpen(false)} />
          <div className="relative w-full max-w-md bg-[#151516] border border-[#262626] rounded-xl shadow-2xl z-10 overflow-hidden text-gray-200 animate-in-fade">
            <div className="p-4 border-b border-[#262626] bg-[#111112] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                {editingMemberProfile ? 'Edit Member Profile' : 'Create New Profile'}
              </h3>
              <button onClick={() => setIsMemberModalOpen(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="p-5 space-y-4 text-xs">
              {memberError && (
                <div className="flex items-center gap-2 p-2.5 bg-rose-950/40 border border-rose-800/40 rounded-lg text-rose-400 text-[11px]">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {memberError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Full Name *</label>
                  <input type="text" required placeholder="Alice Chen" value={memberName} onChange={(e) => setMemberName(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Role / Title</label>
                  <input type="text" placeholder="Developer" value={memberRole} onChange={(e) => setMemberRole(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Email Address</label>
                  <input type="email" placeholder="alice@team.io" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Department</label>
                  <input type="text" placeholder="Engineering" value={memberDept} onChange={(e) => setMemberDept(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Avatar Image URL</label>
                <input type="url" placeholder="https://..." value={memberAvatar} onChange={(e) => setMemberAvatar(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2] mb-2"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">Presets:</span>
                  {PRESET_AVATARS.map((preset, idx) => (
                    <img key={idx} src={preset} alt={`Preset ${idx}`}
                      onClick={() => setMemberAvatar(preset)}
                      className="w-6 h-6 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform border border-[#262626]"
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1 flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  Set PIN for this profile
                  <span className="text-gray-600 ml-1">(4 digits — optional)</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={memberPinInput}
                  onChange={(e) => setMemberPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-32 bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-amber-500 tracking-widest text-center font-mono text-base"
                />
                <p className="text-[10px] text-gray-500 mt-1">Leave blank to let them set it on first login.</p>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Accent Color</label>
                <div className="flex gap-2 flex-wrap">
                  {ACCENT_PRESETS.map((p) => (
                    <button key={p.color} type="button" onClick={() => setMemberAccent(p.color)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${memberAccent === p.color ? 'scale-125 border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      style={{ backgroundColor: p.color }}
                      title={p.name}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#262626]">
                <button type="button" onClick={() => setIsMemberModalOpen(false)} className="px-3 py-1.5 text-gray-400 hover:text-white">
                  Cancel
                </button>
                <button type="submit" disabled={memberSaving}
                  className="bg-[#5E6AD2] hover:bg-[#6E7BE2] disabled:opacity-60 text-white px-4 py-1.5 rounded-md font-semibold flex items-center gap-2"
                >
                  {memberSaving ? 'Saving...' : (editingMemberProfile ? 'Save Changes' : 'Create Profile')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legacy Assignee Modal */}
      {isAddAssigneeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsAddAssigneeModalOpen(false)} />
          <div className="relative w-full max-w-md bg-[#151516] border border-[#262626] rounded-xl shadow-2xl z-10 overflow-hidden text-gray-200 animate-in-fade">
            <div className="p-4 border-b border-[#262626] bg-[#111112] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {editingAssigneeOriginalName ? 'Edit Assignee' : 'Add Assignee to Roster'}
              </h3>
              <button onClick={() => setIsAddAssigneeModalOpen(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAssignee} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Full Name *</label>
                <input type="text" required placeholder="Dr. Aris Thorne" value={newPersonName} onChange={(e) => setNewPersonName(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Role</label>
                <input type="text" placeholder="Principal Investigator" value={newPersonRole} onChange={(e) => setNewPersonRole(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Email</label>
                <input type="email" placeholder="athorne@lab.edu" value={newPersonEmail} onChange={(e) => setNewPersonEmail(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2]"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Avatar Image URL</label>
                <input type="url" placeholder="https://..." value={newPersonAvatar} onChange={(e) => setNewPersonAvatar(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#262626] rounded px-3 py-1.5 text-white focus:outline-none focus:border-[#5E6AD2] mb-2"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">Presets:</span>
                  {PRESET_AVATARS.map((preset, idx) => (
                    <img key={idx} src={preset} alt={`Preset ${idx}`}
                      onClick={() => setNewPersonAvatar(preset)}
                      className="w-6 h-6 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform border border-[#262626]"
                    />
                  ))}
                </div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#262626]">
                <button type="button" onClick={() => setIsAddAssigneeModalOpen(false)} className="px-3 py-1.5 text-gray-400 hover:text-white">
                  Cancel
                </button>
                <button type="submit" className="bg-[#5E6AD2] hover:bg-[#6E7BE2] text-white px-4 py-1.5 rounded-md font-semibold">
                  Save Assignee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// SHA-256 helper (browser native)
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const SettingsView = () => <SettingsInnerContent />;
export const SettingsViewWrapped = SettingsView;
