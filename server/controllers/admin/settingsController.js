const settings = require('../../services/settingsService');

/** GET /api/admin/settings -> {settings: [{key, value, default, source, editable, ...}]} */
exports.list = async (req, res) => {
  res.json({ settings: await settings.list(req.admin) });
};

/** PUT /api/admin/settings/:key {value} or {reset: true} -> {key, value} */
exports.update = async (req, res) => {
  const { key } = req.params;
  const options = { actor: req.admin, ip: req.ip };
  const value = req.body?.reset === true
    ? await settings.reset(key, options)
    : await settings.set(key, req.body?.value, options);
  res.json({ key, value });
};
