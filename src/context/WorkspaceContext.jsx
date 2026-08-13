import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchItemsFromApi,
  addItemToApi,
  updateItemInApi,
  deleteItemFromApi,
  postCommentToApi,
  uploadExcelSheetToApi,
  getExportExcelUrl,
  fetchProfileFromApi,
  saveProfileToApi,
  savePinHashToApi,
  fetchAssigneesFromApi,
  saveAssigneesToApi,
  // Multi-profile API
  fetchProfileListApi,
  fetchProfileByIdApi,
  updateProfileByIdApi,
  createProfileApi,
  deleteProfileApi,
  setProfilePinApi,
  // Auth API
  fetchAuthStatus,
  verifyPinApi,
  setupPinApi,
  validateTokenApi,
  getStoredToken,
  storeToken,
  clearToken,
  getStoredProfile,
  storeProfile,
} from '../api/client';

const WorkspaceContext = createContext();

// ─────────────────────────────────────────────────────────────────────────────
// Auth State Machine:
//   Phase 1 (loading)   → isLoadingAuth = true
//   Phase 2a            → no profiles configured → show "Create PIN" for Team Lead
//   Phase 2b            → profiles exist, no session → show profile picker → PIN entry
//   Phase 2c            → session valid → show workspace (with role-aware UI)
// ─────────────────────────────────────────────────────────────────────────────

export const WorkspaceProvider = ({ children }) => {
  // ── Auth State ────────────────────────────────────────────────────────────
  const [isLoadingAuth, setIsLoadingAuth]         = useState(true);
  const [isConfigured, setIsConfigured]           = useState(false);
  const [isPinUnlocked, setIsPinUnlocked]         = useState(false);
  const [authError, setAuthError]                 = useState('');

  // ── Active User Identity ──────────────────────────────────────────────────
  const [activeProfileId, setActiveProfileId]     = useState(null);  // e.g. "PROF-001"
  const [activeRole, setActiveRole]               = useState('');     // "Team Lead" | other
  const [activeName, setActiveName]               = useState('');

  // Derived permission flag
  const isTeamLead = activeRole === 'Team Lead';

  // ── All Profiles (safe list for picker) ───────────────────────────────────
  const [allProfiles, setAllProfiles]             = useState([]);     // ProfileListItem[]
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // ── Items / Profile / Assignees ───────────────────────────────────────────
  const [items, setItems]                         = useState([]);
  const [userProfile, setUserProfile]             = useState({
    name: '', avatar: '', email: '', role: '',
    department: '', accentColor: '#5E6AD2', profile_id: '',
  });
  const [assigneesList, setAssigneesList]         = useState([]);
  const [backendConnected, setBackendConnected]   = useState(false);
  const [isLoadingBackend, setIsLoadingBackend]   = useState(true);

  // ── Phase 0: Load profile list (public — before auth) ─────────────────────
  const loadProfileList = useCallback(async () => {
    setIsLoadingProfiles(true);
    const list = await fetchProfileListApi();
    if (list && Array.isArray(list)) {
      setAllProfiles(list);
    }
    setIsLoadingProfiles(false);
  }, []);

  // ── Phase 1: Auth Initialization on Mount ─────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      setIsLoadingAuth(true);

      // Load profile list first (needed for profile picker even before auth)
      await loadProfileList();

      if (!mounted) return;

      const status = await fetchAuthStatus();

      if (!mounted) return;

      if (!status) {
        // Backend offline — open workspace as guest
        setIsConfigured(false);
        setIsPinUnlocked(true);
        setActiveRole('Team Lead'); // offline mode: full access
        setIsLoadingAuth(false);
        return;
      }

      setIsConfigured(status.configured);

      if (!status.configured) {
        // No PIN set yet — show Team Lead setup flow
        setIsPinUnlocked(false);
        setIsLoadingAuth(false);
        return;
      }

      // PIN exists — check if we already have a valid session
      if (status.sessionValid) {
        const storedProfileData = getStoredProfile();
        if (storedProfileData) {
          setActiveProfileId(storedProfileData.profileId);
          setActiveRole(storedProfileData.role || '');
          setActiveName(storedProfileData.name || '');
        }
        setIsPinUnlocked(true);
        setIsLoadingAuth(false);
        return;
      }

      // Token missing or expired — validate explicitly
      const storedToken = getStoredToken();
      if (storedToken) {
        const validation = await validateTokenApi();
        if (mounted && validation?.valid) {
          if (validation.profile_id) {
            setActiveProfileId(validation.profile_id);
            setActiveRole(validation.role || '');
            setActiveName(validation.name || '');
            storeProfile({ profileId: validation.profile_id, role: validation.role, name: validation.name });
          }
          setIsPinUnlocked(true);
          setIsLoadingAuth(false);
          return;
        }
        clearToken();
      }

      // Require fresh PIN entry via profile picker
      setIsPinUnlocked(false);
      setIsLoadingAuth(false);
    };

    initAuth();
    return () => { mounted = false; };
  }, []);

  // ── Phase 2: Load workspace data once unlocked ────────────────────────────
  useEffect(() => {
    if (!isPinUnlocked) return;
    let mounted = true;

    const loadWorkspace = async () => {
      setIsLoadingBackend(true);

      // Load the active user's profile specifically (or Team Lead profile as fallback)
      const profileIdToLoad = activeProfileId || 'PROF-001';
      
      const [apiItems, apiProfile, apiAssignees] = await Promise.all([
        fetchItemsFromApi(),
        fetchProfileByIdApi(profileIdToLoad),
        fetchAssigneesFromApi(),
      ]);

      if (!mounted) return;

      if (apiItems && Array.isArray(apiItems)) {
        setItems(apiItems);
        setBackendConnected(true);
      } else {
        setItems([]);
        setBackendConnected(false);
      }

      if (apiProfile) {
        setUserProfile({
          profile_id:  apiProfile.profile_id  || profileIdToLoad,
          name:        apiProfile.name         || '',
          email:       apiProfile.email        || '',
          role:        apiProfile.role         || '',
          department:  apiProfile.department   || '',
          avatar:      apiProfile.avatar       || '',
          accentColor: apiProfile.accentColor  || '#5E6AD2',
        });
        // Sync activeName if it wasn't set
        if (!activeName && apiProfile.name) {
          setActiveName(apiProfile.name);
        }
      }

      if (apiAssignees && Array.isArray(apiAssignees)) {
        setAssigneesList(apiAssignees);
      }

      setIsLoadingBackend(false);
    };

    loadWorkspace();
    return () => { mounted = false; };
  }, [isPinUnlocked, activeProfileId]);

  // ── Auth Actions ──────────────────────────────────────────────────────────

  /** Called after successful PIN verification — stores token and unlocks workspace */
  const unlockPin = useCallback((token, profileId, role, name) => {
    if (token) storeToken(token);
    if (profileId) {
      setActiveProfileId(profileId);
      setActiveRole(role || '');
      setActiveName(name || '');
      storeProfile({ profileId, role, name });
    }
    setIsPinUnlocked(true);
    setAuthError('');
  }, []);

  /** Lock workspace — clears token and returns to profile picker */
  const lockPin = useCallback(() => {
    clearToken();
    setIsPinUnlocked(false);
    setIsLoadingBackend(true);
    setItems([]);
    setActiveProfileId(null);
    setActiveRole('');
    setActiveName('');
    // Reload profile list so picker is fresh
    loadProfileList();
  }, [loadProfileList]);

  /** Verify PIN for a specific profile — returns true on success */
  const verifyPin = useCallback(async (profileId, pinHash) => {
    setAuthError('');
    try {
      const result = await verifyPinApi(profileId, pinHash);
      if (result?.token) {
        storeToken(result.token);
        storeProfile({ profileId: result.profile_id, role: result.role, name: result.name });
        setActiveProfileId(result.profile_id);
        setActiveRole(result.role || '');
        setActiveName(result.name || '');
        setIsPinUnlocked(true);
        return true;
      }
      setAuthError('Verification failed. Please try again.');
      return false;
    } catch (err) {
      setAuthError(err.message || 'Incorrect PIN. Please try again.');
      return false;
    }
  }, []);

  /** Setup initial PIN for Team Lead — returns true on success */
  const setupPin = useCallback(async (pinHash) => {
    setAuthError('');
    try {
      const result = await setupPinApi(pinHash);
      if (result?.token) {
        storeToken(result.token);
        storeProfile({ profileId: result.profile_id || 'PROF-001', role: result.role || 'Team Lead', name: result.name || '' });
        setActiveProfileId(result.profile_id || 'PROF-001');
        setActiveRole(result.role || 'Team Lead');
        setActiveName(result.name || '');
        setIsConfigured(true);
        setIsPinUnlocked(true);
        return true;
      }
      setAuthError('Setup failed. Please try again.');
      return false;
    } catch (err) {
      setAuthError(err.message || 'Failed to create PIN. Please try again.');
      return false;
    }
  }, []);

  /** Legacy: update PIN hash directly */
  const savePinHash = useCallback(async (newHash) => {
    await savePinHashToApi(newHash);
  }, []);

  /** Clear Team Lead PIN — resets to unconfigured */
  const clearPin = useCallback(async () => {
    await savePinHashToApi('');
    clearToken();
    setIsConfigured(false);
    setIsPinUnlocked(true);
  }, []);

  // ── Multi-Profile Management (Team Lead only) ─────────────────────────────

  /** Reload the profile list from backend */
  const refreshProfileList = useCallback(async () => {
    const list = await fetchProfileListApi();
    if (list && Array.isArray(list)) setAllProfiles(list);
  }, []);

  /** Create a new team member profile (Team Lead only) */
  const createMemberProfile = useCallback(async (data) => {
    const result = await createProfileApi(data);
    if (result) await refreshProfileList();
    return result;
  }, [refreshProfileList]);

  /** Delete a team member profile (Team Lead only) */
  const deleteMemberProfile = useCallback(async (profileId) => {
    await deleteProfileApi(profileId);
    await refreshProfileList();
  }, [refreshProfileList]);

  /** Set PIN for a specific profile (Team Lead can set for any; others own only) */
  const setMemberPin = useCallback(async (profileId, pinHash) => {
    return await setProfilePinApi(profileId, pinHash);
  }, []);

  // ── Navigation & Filtering ────────────────────────────────────────────────
  const [activeDomain, setActiveDomain]     = useState('all');
  const [currentView, setCurrentView]       = useState('overview');
  const [searchQuery, setSearchQuery]       = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter]     = useState('all');
  const [sortBy, setSortBy]                 = useState('priority');

  // ── Modals & Drawer ───────────────────────────────────────────────────────
  const [selectedItemId, setSelectedItemId]             = useState(null);
  const [isDrawerOpen, setIsDrawerOpen]                 = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen]       = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen]   = useState(false);

  const selectedItem = items.find(item => item.id === selectedItemId) || null;

  const openItemDetails = (id) => { setSelectedItemId(id); setIsDrawerOpen(true); };
  const closeItemDetails = () => { setIsDrawerOpen(false); };

  // ── Profile ───────────────────────────────────────────────────────────────
  const updateUserProfile = async (updatedFields) => {
    setUserProfile(prev => ({ ...prev, ...updatedFields }));
    const profileId = userProfile.profile_id || activeProfileId || 'PROF-001';
    try {
      await updateProfileByIdApi(profileId, {
        name:        updatedFields.name        ?? userProfile.name,
        email:       updatedFields.email       ?? userProfile.email,
        role:        updatedFields.role        ?? userProfile.role,
        department:  updatedFields.department  ?? userProfile.department,
        avatar:      updatedFields.avatar      ?? userProfile.avatar,
        accentColor: updatedFields.accentColor ?? userProfile.accentColor,
      });
    } catch (err) {
      console.error('[Profile] updateUserProfile failed:', err);
    }
  };

  // ── Assignees ─────────────────────────────────────────────────────────────
  const addAssignee = (newPerson) => {
    setAssigneesList(prev => {
      const updated = [...prev, newPerson];
      saveAssigneesToApi(updated);
      return updated;
    });
  };

  const updateAssignee = (originalName, updatedPerson) => {
    setAssigneesList(prev => {
      const updated = prev.map(a => a.name === originalName ? updatedPerson : a);
      saveAssigneesToApi(updated);
      return updated;
    });
    setItems(prev => prev.map(item =>
      item.assignee?.name === originalName ? { ...item, assignee: updatedPerson } : item
    ));
  };

  const deleteAssignee = (name) => {
    setAssigneesList(prev => {
      const updated = prev.filter(a => a.name !== name);
      saveAssigneesToApi(updated);
      return updated;
    });
  };

  // ── Item CRUD ─────────────────────────────────────────────────────────────
  const addItem = async (newItemData) => {
    const domainPrefixMap = {
      projects: 'PRJ', academic: 'ACA',
      events: 'EVT', teams: 'TEM', other: 'OTH',
    };
    const prefix = domainPrefixMap[newItemData.domain] || 'NEX';
    const newId = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;

    const itemPayload = {
      id: newId,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
      activity: [
        { id: `act-${Date.now()}`, user: userProfile.name || activeName || 'User', time: 'Just now', text: 'Created item.' },
      ],
      ...newItemData,
    };

    setItems(prev => [itemPayload, ...prev]);
    openItemDetails(newId);

    const created = await addItemToApi(itemPayload);
    if (created) setItems(prev => prev.map(i => i.id === newId ? created : i));
  };

  const updateItem = async (id, fieldsToUpdate) => {
    let targetUpdated = null;
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, ...fieldsToUpdate, updatedAt: new Date().toISOString() };
        if (fieldsToUpdate.projectMetrics)  updated.projectMetrics  = { ...item.projectMetrics,  ...fieldsToUpdate.projectMetrics };
        if (fieldsToUpdate.academicMetrics) updated.academicMetrics = { ...item.academicMetrics, ...fieldsToUpdate.academicMetrics };
        if (fieldsToUpdate.eventMetrics)    updated.eventMetrics    = { ...item.eventMetrics,    ...fieldsToUpdate.eventMetrics };
        if (fieldsToUpdate.teamMetrics)     updated.teamMetrics     = { ...item.teamMetrics,     ...fieldsToUpdate.teamMetrics };
        if (fieldsToUpdate.otherMetrics)    updated.otherMetrics    = { ...item.otherMetrics,    ...fieldsToUpdate.otherMetrics };
        targetUpdated = updated;
        return updated;
      })
    );
    if (targetUpdated) await updateItemInApi(targetUpdated);
  };

  const deleteItem = async (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
    if (selectedItemId === id) { setIsDrawerOpen(false); setSelectedItemId(null); }
    await deleteItemFromApi(id);
  };

  const addComment = async (id, commentText, userName) => {
    if (!commentText.trim()) return;
    const author = userName || userProfile.name || activeName || 'User';
    const newComment = {
      id: `act-${Date.now()}`, user: author, time: 'Just now', text: commentText,
    };
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, activity: [newComment, ...(item.activity || [])] } : item
    ));
    const updated = await postCommentToApi(id, commentText, author);
    if (updated) setItems(prev => prev.map(i => i.id === id ? updated : i));
  };

  const importExcelFile = async (file) => {
    const res = await uploadExcelSheetToApi(file);
    if (res?.items) { setItems(res.items); return res.count; }
    return 0;
  };

  const downloadExcelFile = () => window.open(getExportExcelUrl(), '_blank');

  return (
    <WorkspaceContext.Provider
      value={{
        // Auth
        isLoadingAuth,
        isConfigured,
        isPinUnlocked,
        authError,
        setAuthError,
        unlockPin,
        lockPin,
        verifyPin,
        setupPin,
        savePinHash,
        clearPin,

        // Active user identity
        activeProfileId,
        activeRole,
        activeName,
        isTeamLead,

        // Multi-profile management
        allProfiles,
        isLoadingProfiles,
        refreshProfileList,
        createMemberProfile,
        deleteMemberProfile,
        setMemberPin,

        // Data
        items,
        userProfile,
        updateUserProfile,
        assigneesList,
        addAssignee,
        updateAssignee,
        deleteAssignee,
        backendConnected,
        isLoadingBackend,

        // Legacy (kept for backward compat with old components)
        pinHash: null, // deprecated — use allProfiles instead

        // Navigation
        activeDomain, setActiveDomain,
        currentView,  setCurrentView,
        searchQuery,  setSearchQuery,
        priorityFilter, setPriorityFilter,
        statusFilter,   setStatusFilter,
        sortBy,         setSortBy,

        // Modals / Drawer
        selectedItemId,
        selectedItem,
        isDrawerOpen,
        openItemDetails,
        closeItemDetails,
        isCreateModalOpen,  setIsCreateModalOpen,
        isShortcutsModalOpen, setIsShortcutsModalOpen,
        isMobileSidebarOpen,  setIsMobileSidebarOpen,

        // Item CRUD
        addItem,
        updateItem,
        deleteItem,
        addComment,
        importExcelFile,
        downloadExcelFile,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return context;
};
