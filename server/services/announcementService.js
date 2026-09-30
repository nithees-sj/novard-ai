const crypto = require('crypto');
const Report = require('../models/report');
const User = require('../models/user');
const Notification = require('../models/notification');
const settings = require('./settingsService');
const audit = require('./auditService');
const { text, oneOf } = require('../utils/validate');
const { badRequest } = require('../utils/httpError');

/**
 * Announcements from the Novard team: a notification under every student's
 * bell (or only students who recently reported a problem in one area, e.g.
 * after fixing it), and optionally the dashboard banner.
 */

const BATCH = 1000;
const RECENT_DAYS = 30;

async function recipients(audience, area) {
  if (audience === 'area_reporters') {
    if (!area) throw badRequest('Choose the area whose recent reporters should hear this.');
    const since = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000);
    return Report.distinct('userId', { area, createdAt: { $gte: since } });
  }
  return User.distinct('email', { role: 'student', status: { $ne: 'suspended' } });
}

/**
 * @param {object} input { audience: 'all'|'area_reporters', area?, title, body, banner?: boolean, bannerUntil? }
 * @returns {{ announcementId, sent, banner }}
 */
async function broadcast(actor, input = {}, { ip } = {}) {
  const audience = oneOf(input.audience, 'Audience', ['all', 'area_reporters'], { fallback: 'all' });
  const title = text(input.title, 'Title', { max: 120 });
  const body = text(input.body, 'Message', { required: false, max: 1000, collapse: false });
  const area = input.area ? text(input.area, 'Area', { max: 40 }) : undefined;

  const announcementId = crypto.randomBytes(8).toString('hex');
  const users = await recipients(audience, area);
  for (let i = 0; i < users.length; i += BATCH) {
    // eslint-disable-next-line no-await-in-loop
    await Notification.insertMany(users.slice(i, i + BATCH).map((userId) => ({
      userId, kind: 'announcement', title, body, announcementId,
    })), { ordered: false });
  }
  if (input.banner === true) {
    await settings.set('banners.dashboard', { enabled: true, title, body, until: input.bannerUntil || null }, { actor, ip, action: 'announcement.banner' });
  }
  await audit.record({ actor, action: 'announcement.send', target: { type: 'announcement', id: announcementId }, after: { audience, area: area || null, title, sent: users.length, banner: input.banner === true }, ip });
  return { announcementId, sent: users.length, banner: input.banner === true };
}

/** Past announcements (grouped from their notifications), newest first. */
async function list(limit = 30) {
  return Notification.aggregate([
    { $match: { kind: 'announcement', announcementId: { $ne: null } } },
    { $group: { _id: '$announcementId', title: { $first: '$title' }, body: { $first: '$body' }, sent: { $sum: 1 }, read: { $sum: { $cond: [{ $ifNull: ['$readAt', false] }, 1, 0] } }, createdAt: { $min: '$createdAt' } } },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
  ]);
}

module.exports = { broadcast, list };
