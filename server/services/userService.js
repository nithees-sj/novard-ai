const User = require('../models/user');
const { publicUser, issueSessionToken } = require('./authService');
const { badRequest, notFound } = require('../utils/httpError');
const { text, oneOf } = require('../utils/validate');
const { THEMES } = require('../config/preferences');

/** The signed-in student's account details. */

const PHONE = /^\+?[\d\s()-]{7,20}$/;

async function getProfile(email) {
  const user = await User.findOne({ email }).lean();
  if (!user) throw notFound('User not found');
  return publicUser(user);
}

/**
 * Update name, mobile and bio (the same rules as the profile form). Returns the
 * profile and a fresh session token, so the new name is what the forum and the
 * Novard Agent see from now on.
 */
async function updateProfile(email, { name, mobile, bio }) {
  const update = {};
  if (name !== undefined && name !== '') update.name = text(name, 'Name', { max: 80 });
  if (mobile !== undefined) {
    const phone = text(mobile, 'Mobile', { required: false, max: 20 });
    if (phone && !PHONE.test(phone)) throw badRequest('Please enter a valid phone number.');
    update.mobile = phone;
  }
  if (bio !== undefined) update.bio = text(bio, 'Bio', { required: false, max: 500, collapse: false });

  const user = await User.findOneAndUpdate({ email }, { $set: update }, { new: true }).lean();
  if (!user) throw notFound('User not found');
  const profile = publicUser(user);
  return { user: profile, token: issueSessionToken(profile) };
}

/**
 * Save display preferences (just the theme for now). Unlike updateProfile this
 * changes nothing in the session token, so none is issued.
 */
async function updatePreferences(email, { theme } = {}) {
  const update = { theme: oneOf(theme, 'Theme', THEMES) };
  const user = await User.findOneAndUpdate({ email }, { $set: update }, { new: true }).lean();
  if (!user) throw notFound('User not found');
  return { user: publicUser(user) };
}

module.exports = { getProfile, updateProfile, updatePreferences };
