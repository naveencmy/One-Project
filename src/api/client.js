const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// ── Auth Token Management ──────────────────────────────────────────────────────

const TOKEN_KEY = 'nexus_session_token';
const PROFILE_KEY = 'nexus_active_profile'; // { profileId, role, name }

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const storeToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
};

export const getStoredProfile = () => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
export const storeProfile = (profileData) =>
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));

/** Build Authorization header from stored token */
const authHeader = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Auth API ───────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/status
 * Returns { configured: bool, sessionValid: bool }
 */
export const fetchAuthStatus = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/status`, {
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Auth] fetchAuthStatus failed:', err);
    return null;
  }
};

/**
 * POST /api/auth/verify
 * Validates a SHA-256 PIN hash for a specific profile.
 * Body: { profile_id, pin_hash }
 * Returns { token, expiresIn, profile_id, role, name } or throws on failure.
 */
export const verifyPinApi = async (profileId, pinHash) => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId, pin_hash: pinHash }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json(); // { token, expiresIn, profile_id, role, name }
  } catch (err) {
    console.error('[Auth] verifyPin failed:', err);
    throw err;
  }
};

/**
 * POST /api/auth/setup
 * Creates the initial PIN for Team Lead (PROF-001).
 * Returns { token, expiresIn, profile_id, role, name } on success.
 */
export const setupPinApi = async (pinHash) => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_hash: pinHash }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[Auth] setupPin failed:', err);
    throw err;
  }
};

/**
 * GET /api/auth/validate
 * Returns { valid: bool, profile_id?, role?, name? } for the stored token.
 */
export const validateTokenApi = async () => {
  const token = getStoredToken();
  if (!token) return { valid: false };
  try {
    const res = await fetch(`${API_BASE_URL}/auth/validate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { valid: false };
    return await res.json();
  } catch {
    return { valid: false };
  }
};

// ── Multi-Profile API ──────────────────────────────────────────────────────────

/**
 * GET /api/profiles/list
 * Returns safe profile list for the profile picker (no PIN hashes).
 */
export const fetchProfileListApi = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/profiles/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Profile] fetchProfileList failed:', err);
    return null;
  }
};

/**
 * GET /api/profiles/{id}
 * Returns a single profile's data (auth required).
 */
export const fetchProfileByIdApi = async (profileId) => {
  try {
    const res = await fetch(`${API_BASE_URL}/profiles/${encodeURIComponent(profileId)}`, {
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[Profile] fetchProfileById failed:', err);
    return null;
  }
};

/**
 * PUT /api/profiles/{id}
 * Updates a profile (own profile only; Team Lead can update any).
 */
export const updateProfileByIdApi = async (profileId, data) => {
  try {
    const res = await fetch(`${API_BASE_URL}/profiles/${encodeURIComponent(profileId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[Profile] updateProfileById failed:', err);
    throw err;
  }
};

/**
 * POST /api/profiles/create
 * Creates a new profile (Team Lead only).
 */
export const createProfileApi = async (data) => {
  try {
    const res = await fetch(`${API_BASE_URL}/profiles/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[Profile] createProfile failed:', err);
    throw err;
  }
};

/**
 * DELETE /api/profiles/{id}
 * Deletes a profile (Team Lead only).
 */
export const deleteProfileApi = async (profileId) => {
  try {
    const res = await fetch(`${API_BASE_URL}/profiles/${encodeURIComponent(profileId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[Profile] deleteProfile failed:', err);
    throw err;
  }
};

/**
 * PUT /api/profiles/pin
 * Set or update PIN for a profile.
 * Body: { profile_id, pin_hash }
 */
export const setProfilePinApi = async (profileId, pinHash) => {
  try {
    const res = await fetch(`${API_BASE_URL}/profiles/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ profile_id: profileId, pin_hash: pinHash }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[Profile] setProfilePin failed:', err);
    throw err;
  }
};

// ── Items API ──────────────────────────────────────────────────────────────────

export const fetchItemsFromApi = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/items`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data || [];
  } catch (err) {
    console.warn('Go backend unavailable:', err);
    return null;
  }
};

export const addItemToApi = async (newItemData) => {
  try {
    const res = await fetch(`${API_BASE_URL}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItemData),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to add item:', err);
    return null;
  }
};

export const updateItemInApi = async (updatedItem) => {
  try {
    const res = await fetch(`${API_BASE_URL}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedItem),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to update item:', err);
    return null;
  }
};

export const deleteItemFromApi = async (id) => {
  try {
    const res = await fetch(`${API_BASE_URL}/items?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to delete item:', err);
    return null;
  }
};

export const postCommentToApi = async (itemId, text, user = 'User') => {
  try {
    const res = await fetch(`${API_BASE_URL}/items/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, text, user }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to post comment:', err);
    return null;
  }
};

// ── Excel API ──────────────────────────────────────────────────────────────────

export const getExportExcelUrl = () => `${API_BASE_URL}/excel/export`;

export const uploadExcelSheetToApi = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/excel/import`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to upload excel file:', err);
    return null;
  }
};

export const fetchExcelSheetsFromApi = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/excel/sheets`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch sheet metadata:', err);
    return null;
  }
};

// ── Legacy Profile API (Team Lead only backward compat) ────────────────────────

export const fetchProfileFromApi = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/profile`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch profile:', err);
    return null;
  }
};

export const saveProfileToApi = async (profileData) => {
  try {
    const res = await fetch(`${API_BASE_URL}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to save profile:', err);
    return null;
  }
};

/** @deprecated Use setProfilePinApi instead */
export const savePinHashToApi = async (pinHash) => {
  try {
    const res = await fetch(`${API_BASE_URL}/profile/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinHash }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to save PIN hash (legacy):', err);
    return null;
  }
};

// ── Assignees API ──────────────────────────────────────────────────────────────

export const fetchAssigneesFromApi = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/assignees`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch assignees:', err);
    return null;
  }
};

export const saveAssigneesToApi = async (assignees) => {
  try {
    const res = await fetch(`${API_BASE_URL}/assignees`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignees),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to save assignees:', err);
    return null;
  }
};
