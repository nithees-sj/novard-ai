const notifications = require('../services/notificationService');
const { sweepDueReminders } = require('../services/todoService');
const { sweepExamReminders } = require('../services/examService');
const logger = require('../utils/logger');

/**
 * GET /api/notifications?today=YYYY-MM-DD -> {notifications, unread}
 * Due todo tasks and today's Exam Autopilot plan are turned into reminders
 * first (nothing runs on a timer);
 * a failure there never keeps the bell from loading.
 */
exports.list = async (req, res) => {
  try {
    await sweepDueReminders(req.user.email, req.query.today);
  } catch (error) {
    logger.warn('Todo reminder sweep failed', { error: error.message });
  }
  try {
    await sweepExamReminders(req.user.email, req.query.today);
  } catch (error) {
    logger.warn('Exam reminder sweep failed', { error: error.message });
  }
  res.json(await notifications.listNotifications(req.user.email));
};

/** POST /api/notifications/read {ids?} -> {updated}. No ids = all. */
exports.markRead = async (req, res) => {
  res.json(await notifications.markRead(req.user.email, req.body?.ids));
};
