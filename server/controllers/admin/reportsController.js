const reports = require('../../services/reportService');

const opts = (req) => ({ ip: req.ip });

/** GET /api/admin/reports?area&status&urgency&intent&assignedTo&from&to&q&page&limit */
exports.list = async (req, res) => {
  res.json(await reports.listForAdmin(req.query));
};

/** GET /api/admin/reports/:ref */
exports.get = async (req, res) => {
  res.json(await reports.getForAdmin(req.params.ref));
};

/** GET /api/admin/reports/:ref/attachments/:n */
exports.attachment = async (req, res) => {
  const { file, mime, name } = await reports.adminAttachment(req.params.ref, req.params.n);
  res.set('Content-Type', mime || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${String(name).replace(/[^\w.-]/g, '_')}"`);
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(file);
};

/** POST /api/admin/reports/:ref/reporter-email -> {email} (audited) */
exports.revealEmail = async (req, res) => {
  res.json(await reports.revealEmail(req.admin, req.params.ref, opts(req)));
};

/** POST /api/admin/reports/:ref/status {status, note?} */
exports.setStatus = async (req, res) => {
  res.json(await reports.setStatus(req.admin, req.params.ref, req.body?.status, { note: req.body?.note, ...opts(req) }));
};

/** POST /api/admin/reports/:ref/notes {body, internal} */
exports.addNote = async (req, res) => {
  res.json(await reports.addAdminNote(req.admin, req.params.ref, { body: req.body?.body, internal: req.body?.internal === true }, opts(req)));
};

/** POST /api/admin/reports/:ref/assign {assignee|null} */
exports.assign = async (req, res) => {
  res.json(await reports.assign(req.admin, req.params.ref, req.body?.assignee, opts(req)));
};

/** POST /api/admin/reports/resolve {refs, note?, status?} */
exports.resolve = async (req, res) => {
  res.json(await reports.resolveReports({ refs: req.body?.refs, note: req.body?.note, status: req.body?.status, actor: req.admin, ...opts(req) }));
};

/** POST /api/admin/areas/:area/resolve {note?, status?} - everything open in the area */
exports.resolveArea = async (req, res) => {
  res.json(await reports.resolveReports({ area: req.params.area, note: req.body?.note, status: req.body?.status, actor: req.admin, ...opts(req) }));
};
