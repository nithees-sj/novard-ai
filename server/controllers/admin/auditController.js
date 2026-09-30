const audit = require('../../services/auditService');

/** GET /api/admin/audit-log?adminId&action&targetType&targetId&from&to&page&limit */
exports.list = async (req, res) => {
  res.json(await audit.list(req.query));
};
