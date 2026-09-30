const mongoose = require('mongoose');

/**
 * Runtime settings an admin changed from the console (services/settingsService.js).
 * Only overrides are stored; everything else comes from env or config defaults.
 * The reserved key `__version` counts writes, so every server instance can
 * tell cheaply whether its cached copy is stale.
 */
const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed,
  updatedBy: String,
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('Setting', settingSchema);
