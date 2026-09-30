const audit = require('../../services/auditService');
const { rescanAll } = require('../../services/earlyWarning/rescan');

/** POST /api/admin/risk/rescan {full?} -> the rescan summary. */
exports.rescan = async (req, res) => {
  const result = await rescanAll({ trigger: 'admin', full: req.body?.full === true });
  await audit.record({ actor: req.admin, action: 'risk.rescan', target: { type: 'risk', id: 'all' }, after: { full: req.body?.full === true, alerts: result.alerts?.length ?? 0, skipped: Boolean(result.skipped) }, ip: req.ip });
  res.json(result);
};
