/**
 * Per-user display preferences, saved on the account so they follow the user
 * across devices (PUT /api/auth/preferences).
 *
 *   theme   'light' | 'dark' | 'system' (follow the device). Unset until the
 *           user first chooses, so the client can tell "never chosen" apart.
 */
const THEMES = ['light', 'dark', 'system'];

module.exports = { THEMES };
