const AdminAuditLog = require('../models/adminAuditLog');
const { integer, text } = require('../utils/validate');
const logger = require('../utils/logger');

/**
 * The admin audit log. record() is called from inside every mutating admin
 * service function, so a change made from the console, by the admin assistant
 * or by approving a recommendation is audited the same way.
 */

/** Keep audited values small: long strings are cut and deep objects kept as they are. */
function compact(value) {
  if (value === undefined) return null;
  const json = JSON.stringify(value);
  if (json && json.length > 8000) return { truncated: true, preview: json.slice(0, 8000) };
  return value;
}

/**
 * @param {object} entry
 * @param {{email: string, role?: string}|string} entry.actor  the admin (or 'cli' / 'system')
 * @param {string} entry.action   dotted verb, e.g. "setting.update"
 * @param {{type: string, id: string}} [entry.target]
 */
async function record({ actor, action, target, before, after, ip }) {
  const adminId = typeof actor === 'string' ? actor : actor?.email || 'system';
  const adminRole = typeof actor === 'string' ? actor : actor?.role;
  try {
    await AdminAuditLog.create({
      adminId,
      adminRole,
      action,
      target: target ? { type: target.type, id: String(target.id ?? '') } : undefined,
      before: compact(before),
      after: compact(after),
      ip,
    });
  } catch (error) {
    // The change itself already happened; losing its audit row must be loud.
    logger.error('Could not write an admin audit entry', { action, adminId, error: error.message });
  }
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The audit log, newest first, filtered by admin, action prefix, target or date. */
async function list(query = {}) {
  const filter = {};
  if (query.adminId) filter.adminId = text(query.adminId, 'Admin', { max: 200 }).toLowerCase();
  if (query.action) filter.action = new RegExp(`^${escapeRegex(text(query.action, 'Action', { max: 60 }))}`);
  if (query.targetType) filter['target.type'] = text(query.targetType, 'Target type', { max: 40 });
  if (query.targetId) filter['target.id'] = text(query.targetId, 'Target', { max: 200 });
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
    filter.createdAt = {};
    if (from && !Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) filter.createdAt.$lte = to;
  }
  const limit = integer(query.limit, 'Limit', { min: 1, max: 200, required: false, fallback: 50 });
  const page = integer(query.page, 'Page', { min: 1, max: 10000, required: false, fallback: 1 });
  const [entries, total] = await Promise.all([
    AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AdminAuditLog.countDocuments(filter),
  ]);
  return { entries, total, page, limit };
}

module.exports = { record, list };
