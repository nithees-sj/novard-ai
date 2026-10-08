const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const teachBack = require('../services/teachBackService');
const { currentUserId } = require('../middleware/auth');
const { uploadDir } = require('../utils/uploads');
const { unsupportedMediaType } = require('../utils/httpError');
const { REPORTS } = require('../config/earlyWarning');

/** Teach-Back Arena. The owner is always the signed-in student. */
const me = (req) => currentUserId(req);

/** A recorded explanation: kept only until it is transcribed (the service checks its real bytes). */
const voiceUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir('teachback')),
    filename: (req, file, cb) => cb(null, `tb-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname || '').slice(0, 6)}`),
  }),
  limits: { fileSize: REPORTS.maxVoiceBytes, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => (/^(audio\/|video\/webm)/.test(file.mimetype)
    ? cb(null, true)
    : cb(unsupportedMediaType('The recording must be audio.'))),
});
exports.voiceUpload = voiceUpload.single('voice');

exports.list = async (req, res) => {
  res.json({ sessions: await teachBack.listSessions(me(req)) });
};

exports.voice = async (req, res) => {
  res.json({ enabled: await teachBack.voiceEnabled(), maxFollowUps: teachBack.MAX_FOLLOW_UPS });
};

exports.get = async (req, res) => {
  res.json(await teachBack.getSession(me(req), req.params.id));
};

exports.start = async (req, res) => {
  const { noteId, concept, focus, examRef } = req.body || {};
  res.status(201).json(await teachBack.startSession({ userId: me(req), file: req.file, noteId: noteId || undefined, concept, focus, examRef: examRef || undefined }));
};

exports.turn = async (req, res) => {
  res.json(await teachBack.addTurn({ userId: me(req), id: req.params.id, message: req.body?.message, file: req.file }));
};

exports.finish = async (req, res) => {
  res.json(await teachBack.finishSession({ userId: me(req), id: req.params.id, today: req.body?.today || req.query.today }));
};

exports.coach = async (req, res) => {
  res.json(await teachBack.coach({ userId: me(req), id: req.params.id, message: req.body?.message }));
};

exports.remove = async (req, res) => {
  res.json(await teachBack.deleteSession(me(req), req.params.id));
};
