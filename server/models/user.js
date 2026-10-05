const mongoose = require('mongoose');
const { ROLES, STATUSES } = require('../config/admin');
const { THEMES } = require('../config/preferences');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  picture: String,
  mobile: String,
  bio: String,
  // Admin console access (config/admin.js). Everyone signs up as a student.
  role: { type: String, enum: ROLES, default: 'student', index: true },
  // A suspended account is signed out on its next request.
  status: { type: String, enum: STATUSES, default: 'active', index: true },
  suspendedAt: Date,
  suspendedReason: String,
  // Display theme (config/preferences.js). No default: unset means never chosen.
  theme: { type: String, enum: THEMES },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
