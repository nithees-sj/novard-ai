const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const reports = require('../services/reportService');
const { uploadDir } = require('../utils/uploads');
const { unsupportedMediaType } = require('../utils/httpError');
const { REPORTS } = require('../config/earlyWarning');

// Screenshots, a voice note and a PDF. The browser's MIME type is only a
// first filter; reportService checks every file's real bytes.
const ACCEPT = {
  screenshot: /^image\/(png|jpe?g|webp)$/,
  voice: /^(audio\/|video\/webm)/, // Chrome records audio as video/webm in some versions
  pdf: /^application\/pdf$/,
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir('reports')),
    filename: (req, file, cb) => cb(null, `rep-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname || '').slice(0, 6)}`),
  }),
  limits: { fileSize: Math.max(REPORTS.maxScreenshotBytes, REPORTS.maxVoiceBytes, REPORTS.maxPdfBytes), files: 3, fields: 10, fieldSize: 64 * 1024 },
  fileFilter: (req, file, cb) => {
    const rule = ACCEPT[file.fieldname];
    if (!rule) return cb(unsupportedMediaType(`Unexpected file field "${file.fieldname}".`));
    return rule.test(file.mimetype) ? cb(null, true) : cb(unsupportedMediaType('That file type is not supported for this attachment.'));
  },
});
exports.upload = upload.fields([{ name: 'screenshot', maxCount: 1 }, { name: 'voice', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]);

/** POST /api/reports?area=  (multipart: text, source (JSON), routedBy, screenshot?, voice?, pdf?) -> 201 report */
exports.create = async (req, res) => {
  res.status(201).json(await reports.createReport({ user: req.user, area: req.reportArea, body: req.body, files: req.files }));
};

/** GET /api/reports/mine -> {reports, maxOpenPerArea} */
exports.mine = async (req, res) => {
  res.json(await reports.listMine(req.user.email));
};

/** GET /api/reports/:ref -> report (the student's own) */
exports.get = async (req, res) => {
  res.json(await reports.getMine(req.user.email, req.params.ref));
};

/** POST /api/reports/:ref/notes {body} -> report */
exports.addNote = async (req, res) => {
  res.json(await reports.addStudentNote(req.user, req.params.ref, req.body?.body));
};

/** GET /api/reports/:ref/attachments/:n -> the file */
exports.attachment = async (req, res) => {
  const { file, mime, name } = await reports.myAttachment(req.user.email, req.params.ref, req.params.n);
  res.set('Content-Type', mime || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${String(name).replace(/[^\w.-]/g, '_')}"`);
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(file);
};
