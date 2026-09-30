const mongoose = require('mongoose');
const Notification = require('../models/notification');
const { badRequest } = require('../utils/httpError');
const { isObjectId } = require('../utils/validate');

/**
 * Students' notifications (the bell). Always scoped to the session user.
 */

const LIST_LIMIT = 50;

const present = (n) => ({
  _id: n._id,
  kind: n.kind,
  title: n.title,
  body: n.body,
  reportRefs: n.reportRefs || [],
  link: n.link || null,
  read: Boolean(n.readAt),
  createdAt: n.createdAt,
});

/** The student's latest notifications and how many are unread. */
async function listNotifications(userId) {
  const [items, unread] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(LIST_LIMIT).lean(),
    Notification.countDocuments({ userId, readAt: null }),
  ]);
  return { notifications: items.map(present), unread };
}

/** Mark the given notifications (or all) as read. Returns how many changed. */
async function markRead(userId, ids) {
  const filter = { userId, readAt: null };
  if (ids !== undefined) {
    if (!Array.isArray(ids) || ids.length > 200 || !ids.every(isObjectId)) throw badRequest('ids must be a list of notification ids.');
    filter._id = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
  }
  const { modifiedCount } = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  return { updated: modifiedCount };
}

/** Create notifications (server-side only). `items` is one object or a list. */
async function notify(items) {
  const list = Array.isArray(items) ? items : [items];
  if (!list.length) return [];
  return Notification.insertMany(list.map((n) => ({ ...n, title: String(n.title).slice(0, 200), body: String(n.body || '').slice(0, 2000) })), { ordered: false });
}

module.exports = { listNotifications, markRead, notify, present };
