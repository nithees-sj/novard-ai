const notifications = require('../services/notificationService');

/** GET /api/notifications -> {notifications, unread} */
exports.list = async (req, res) => {
  res.json(await notifications.listNotifications(req.user.email));
};

/** POST /api/notifications/read {ids?} -> {updated}. No ids = all. */
exports.markRead = async (req, res) => {
  res.json(await notifications.markRead(req.user.email, req.body?.ids));
};
