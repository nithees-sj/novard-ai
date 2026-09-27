import axios from 'axios';
import { getToken, SESSION_EXPIRED_EVENT } from './session';

/**
 * The one way the client talks to the API.
 *
 *   api        an axios instance: base URL, timeout and the session token
 *              are applied to every request
 *   apiFetch   the same for fetch() (streaming responses, keepalive requests)
 *
 * A 401 from the API means the session is missing or expired: the app is told
 * (SESSION_EXPIRED_EVENT) and signs the student out.
 */

export const API_URL = process.env.REACT_APP_API_ENDPOINT || '';

// Generous, because plan and roadmap generation legitimately run for a minute or more.
const TIMEOUT_MS = 120000;

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const notifyExpired = () => window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));

export const api = axios.create({ baseURL: API_URL, timeout: TIMEOUT_MS });

api.interceptors.request.use((config) => {
  Object.assign(config.headers, authHeaders());
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) notifyExpired();
    return Promise.reject(error);
  },
);

/** fetch() against the API with the session token. Resolves with the Response, like fetch. */
export async function apiFetch(path, { headers, ...init } = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { ...authHeaders(), ...headers } });
  if (response.status === 401) notifyExpired();
  return response;
}

/** apiFetch for JSON endpoints: the parsed body, or an Error carrying the API's message (and body as `data`). */
export async function apiJson(path, { body, headers, ...init } = {}) {
  const response = await apiFetch(path, {
    ...init,
    headers: body !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || `Request failed (${response.status})`), { status: response.status, data });
  return data;
}

/** The message to show for a failed axios request. */
export const errorMessage = (error, fallback) => error?.response?.data?.error || fallback;
