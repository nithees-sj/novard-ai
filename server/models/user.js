const mongoose = require('mongoose');
const { ROLES, STATUSES } = require('../config/admin');

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
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
