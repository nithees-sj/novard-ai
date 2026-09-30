import axios from 'axios';
import { API_URL } from './api';

/**
 * The admin console's API client. It carries the ADMIN session token (kept
 * apart from the student session, so signing in to one never touches the
 * other). A 401 means the admin session ended or the account lost admin
 * access: the console is told (ADMIN_SESSION_EVENT) and returns to its sign-in.
 */

const TOKEN_KEY = 'admin_token';
const PROFILE_KEY = 'admin_profile';
export const ADMIN_SESSION_EVENT = 'novard:admin-session-ended';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const getAdminToken = () => read(TOKEN_KEY);

export function getStoredAdmin() {
  try {
    const raw = read(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAdminSession({ token, admin }) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(admin));
  } catch {
    // storage blocked: the session lasts until the tab closes
  }
  return admin;
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    // nothing stored
  }
}

const authHeaders = () => {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const adminApi = axios.create({ baseURL: API_URL, timeout: 120000 });

adminApi.interceptors.request.use((config) => {
  Object.assign(config.headers, authHeaders());
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !String(error.config?.url || '').includes('/api/admin/auth/google')) {
      window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EVENT, { detail: { message: error.response.data?.error } }));
    }
    return Promise.reject(error);
  },
);

/** fetch() with the admin token (for streams). */
export async function adminFetch(path, { headers, ...init } = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { ...authHeaders(), ...headers } });
  if (response.status === 401) window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EVENT, { detail: {} }));
  return response;
}

/** GET helper returning the body. */
export const adminGet = (path, params) => adminApi.get(path, { params }).then((r) => r.data);
export const adminPost = (path, body) => adminApi.post(path, body).then((r) => r.data);
export const adminPut = (path, body) => adminApi.put(path, body).then((r) => r.data);
export const adminDelete = (path) => adminApi.delete(path).then((r) => r.data);
