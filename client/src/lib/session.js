/**
 * The signed-in student's session, kept in localStorage so a refresh stays
 * signed in.
 *
 *   auth_token   the API session token (sent as "Authorization: Bearer ...")
 *   auth_user    { name, email, picture, displayName, photoURL }
 *   name, email, profilePic   older keys that some pages still read directly
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const LEGACY_KEYS = ['name', 'email', 'profilePic'];

/** Event fired when the API rejects the session, so the app can sign out. */
export const SESSION_EXPIRED_EVENT = 'novard:session-expired';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const getToken = () => read(TOKEN_KEY);

export function getStoredUser() {
  try {
    const raw = read(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** The signed-in student's email (their user id in the API), or ''. */
export const currentEmail = () => getStoredUser()?.email || read('email') || '';

/** The signed-in student's display name, or ''. */
export const currentName = () => getStoredUser()?.name || read('name') || '';

/** Save a session: the token and the profile the API returned. */
export function saveSession({ token, user }) {
  const profile = {
    name: user.name || '',
    email: user.email,
    picture: user.picture || '',
    // Older components read these names.
    displayName: user.name || '',
    photoURL: user.picture || '',
  };
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    localStorage.setItem('name', profile.name);
    localStorage.setItem('email', profile.email);
    localStorage.setItem('profilePic', profile.picture);
  } catch {
    // Storage full or blocked: the session lasts until the tab closes.
  }
  return profile;
}

export function clearSession() {
  try {
    [TOKEN_KEY, USER_KEY, ...LEGACY_KEYS].forEach((key) => localStorage.removeItem(key));
  } catch {
    // nothing stored
  }
}

/** A stored session that can call the API. Sessions saved before sign-in used tokens have none and must sign in again. */
export function restoreSession() {
  const user = getStoredUser();
  const token = getToken();
  if (!user?.email || !token) {
    clearSession();
    return null;
  }
  return user;
}
