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
  // New auth API
  fetchAuthStatus,
  verifyPinApi,
  setupPinApi,
  validateTokenApi,
  getStoredToken,
  storeToken,
  clearToken,
} from '../api/client';

const WorkspaceContext = createContext();

// ─────────────────────────────────────────────────────────────────────────────
// Auth State Machine:
//   Phase 1 (loading)  → isLoadingAuth = true
//   Phase 2a           → isConfigured = false  → show "Create PIN" modal
//   Phase 2b           → isConfigured = true, isPinUnlocked = false → show "Enter PIN" modal
//   Phase 2c           → isConfigured = true, isPinUnlocked = true  → show workspace
// ─────────────────────────────────────────────────────────────────────────────

export const WorkspaceProvider = ({ children }) => {
  // ── Auth State ────────────────────────────────────────────────────────────
  const [isLoadingAuth, setIsLoadingAuth]     = useState(true);
  const [isConfigured, setIsConfigured]       = useState(false);   // PIN exists in backend
  const [isPinUnlocked, setIsPinUnlocked]     = useState(false);   // Session is valid
  const [authError, setAuthError]             = useState('');

  // ── Items / Profile / Assignees ───────────────────────────────────────────
  const [items, setItems]                     = useState([]);
  const [userProfile, setUserProfile]         = useState({
    name: '', avatar: '', email: '', role: '',
    department: '', accentColor: '#5E6AD2',
  });
  const [assigneesList, setAssigneesList]     = useState([]);
  const [backendConnected, setBackendConnected] = useState(false);
  const [isLoadingBackend, setIsLoadingBackend] = useState(true);

  // ── Phase 1: Auth Initialization on Mount ─────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      setIsLoadingAuth(true);

      // 1. Ask backend: is a PIN configured?
      const status = await fetchAuthStatus(); // sends stored token automatically

      if (!mounted) return;

      if (!status) {
        // Backend offline — skip auth gate
        setIsConfigured(false);
        setIsPinUnlocked(true); // offline mode: open workspace
        setIsLoadingAuth(false);
        return;
      }

      setIsConfigured(status.configured);

      if (!status.configured) {
        // No PIN set yet — show setup flow
        setIsPinUnlocked(false);
        setIsLoadingAuth(false);
        return;
      }

      // PIN exists. Check if we already have a valid token.
      if (status.sessionValid) {
        // Token in localStorage is valid (backend confirmed)
        setIsPinUnlocked(true);
        setIsLoadingAuth(false);
        return;
      }

      // Token missing or expired — validate explicitly
      const storedToken = getStoredToken();
      if (storedToken) {
        const validation = await validateTokenApi();
        if (mounted && validation?.valid) {
          setIsPinUnlocked(true);
          setIsLoadingAuth(false);
          return;
        }
        // Token was invalid — clear it
        clearToken();
      }

      // Require fresh PIN entry
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

      const [apiItems, apiProfile, apiAssignees] = await Promise.all([
        fetchItemsFromApi(),
        fetchProfileFromApi(),
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
          name:        apiProfile.name        || '',
          email:       apiProfile.email       || '',
          role:        apiProfile.role        || '',
          department:  apiProfile.department  || '',
          avatar:      apiProfile.avatar      || '',
          accentColor: apiProfile.accentColor || '#5E6AD2',
        });
      }

      if (apiAssignees && Array.isArray(apiAssignees)) {
        setAssigneesList(apiAssignees);
      }

      setIsLoadingBackend(false);
    };

    loadWorkspace();
    return () => { mounted = false; };
  }, [isPinUnlocked]);

  // ── Auth Actions ──────────────────────────────────────────────────────────

  /** Called after successful PIN verification — stores token and unlocks workspace */
  const unlockPin = useCallback((token) => {
    if (token) storeToken(token);
    setIsPinUnlocked(true);
    setAuthError('');
  }, []);

  /** Lock workspace — clears token and returns to PIN gate */
  const lockPin = useCallback(() => {
    clearToken();
    setIsPinUnlocked(false);
    setIsLoadingBackend(true);
    setItems([]);
  }, []);

  /** Verify existing PIN — returns true on success */
  const verifyPin = useCallback(async (pinHash) => {
    setAuthError('');
    try {
      const result = await verifyPinApi(pinHash);
      if (result?.token) {
        storeToken(result.token);
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

  /** Setup initial PIN — returns true on success */
  const setupPin = useCallback(async (pinHash) => {
    setAuthError('');
    try {
      const result = await setupPinApi(pinHash);
      if (result?.token) {
        storeToken(result.token);
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

  /** Legacy: update PIN hash directly (for settings page) */
  const savePinHash = useCallback(async (newHash) => {
    await savePinHashToApi(newHash);
  }, []);

  /** Clear PIN — resets workspace to unconfigured state */
  const clearPin = useCallback(async () => {
    await savePinHashToApi('');
    clearToken();
    setIsConfigured(false);
    setIsPinUnlocked(true); // stay in workspace after clearing
  }, []);

  // ── Navigation & Filtering ────────────────────────────────────────────────
  const [activeDomain, setActiveDomain]     = useState('all');
  const [currentView, setCurrentView]       = useState('overview');
  const [searchQuery, setSearchQuery]       = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter]     = useState('all');
  const [sortBy, setSortBy]                 = useState('priority');

  // ── Modals & Drawer ───────────────────────────────────────────────────────
  const [selectedItemId, setSelectedItemId]         = useState(null);
  const [isDrawerOpen, setIsDrawerOpen]             = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen]   = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen]   = useState(false);

  const selectedItem = items.find(item => item.id === selectedItemId) || null;

  const openItemDetails = (id) => { setSelectedItemId(id); setIsDrawerOpen(true); };
  const closeItemDetails = () => { setIsDrawerOpen(false); };

  // ── Profile ───────────────────────────────────────────────────────────────
  const updateUserProfile = (updatedFields) => {
    setUserProfile(prev => ({ ...prev, ...updatedFields }));
    saveProfileToApi({
      name:        updatedFields.name        ?? userProfile.name,
      email:       updatedFields.email       ?? userProfile.email,
      role:        updatedFields.role        ?? userProfile.role,
      department:  updatedFields.department  ?? userProfile.department,
      avatar:      updatedFields.avatar      ?? userProfile.avatar,
      accentColor: updatedFields.accentColor ?? userProfile.accentColor,
    });
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
        { id: `act-${Date.now()}`, user: userProfile.name || 'User', time: 'Just now', text: 'Created item.' },
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
    const author = userName || userProfile.name || 'User';
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
