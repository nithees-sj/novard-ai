const { AI_FEATURES } = require('../config/admin');
const settings = require('../services/settingsService');
const { runWithAi } = require('../ai/aiContext');
const { assertToolEnabled, consumeStudentQuota } = require('../ai/usageGuard');
const { assertWithinTokenLimit } = require('../ai/tokenLimits');
const { HttpError } = require('../utils/httpError');

/**
 * The admin's switches and limits, on routes:
 *
 *   aiFeature('notes.chat')  an AI-backed route: its tool must be switched on,
 *                            it counts against the student's daily AI quota,
 *                            the student must have token allowance left for
 *                            the tool (ai/tokenLimits.js), and every model
 *                            call it makes is logged under
 *                            that feature (ai/aiContext.js)
 *   toolGate('notes')        a route of a tool that makes no model call
 *                            (uploading a PDF, adding a video)
 *   maintenanceGate          the whole student app in maintenance mode
 *
 * A switched-off tool gets a friendly 503 with the admin's message; the
 * client shows it like any other API error.
 */

function aiFeature(feature, { quota = true, gate = true } = {}) {
  const def = AI_FEATURES[feature];
  if (!def) throw new Error(`Unknown AI feature: ${feature}`);
  return async (req, res, next) => {
    try {
      if (gate) await assertToolEnabled(def.tool);
      if (quota) await consumeStudentQuota(req.user?.email);
      if (!def.admin) await assertWithinTokenLimit(req.user?.email, def.tool);
    } catch (error) {
      return next(error);
    }
    return runWithAi({ feature, area: def.area, userId: req.user?.email }, () => next());
  };
}

function toolGate(tool, { area } = {}) {
  return async (req, res, next) => {
    try {
      await assertToolEnabled(tool);
    } catch (error) {
      return next(error);
    }
    return area ? runWithAi({ area, userId: req.user?.email }, () => next()) : next();
  };
}

// Paths that keep working in maintenance mode: sign-in, the status the app
// shows, the admin console and the scheduler.
const MAINTENANCE_EXEMPT = /^\/(api\/auth\/|api\/app-status|api\/admin\/|api\/internal\/|health$|$)/;
const MAINTENANCE_DEFAULT = 'Novard-AI is down for maintenance. Please check back soon.';

async function maintenanceGate(req, res, next) {
  if (MAINTENANCE_EXEMPT.test(req.path)) return next();
  try {
    const { enabled, message } = await settings.get('maintenance.global');
    if (enabled) return next(new HttpError(503, message || MAINTENANCE_DEFAULT, { code: 'MAINTENANCE' }));
  } catch (error) {
    return next(error);
  }
  return next();
}

module.exports = { aiFeature, toolGate, maintenanceGate };
