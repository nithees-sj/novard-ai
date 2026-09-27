const multer = require('multer');
const notes = require('../services/notesService');
const { currentUserId } = require('../middleware/auth');
const { uploadDir } = require('../utils/uploads');
const { unsupportedMediaType } = require('../utils/httpError');

const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** PDF uploads: stored under UPLOAD_DIR/notes with a generated name (never the client's file name). */
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir('notes')),
    filename: (req, file, cb) => cb(null, `pdf-${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`),
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(unsupportedMediaType('Only PDF files are allowed'), false);
  },
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
});

exports.upload = upload;

exports.uploadNotes = async (req, res) => {
  const userId = currentUserId(req, req.body.userId);
  const note = await notes.createNote({ userId, file: req.file, title: req.body.title });
  res.status(201).json({ ...note, message: 'Notes uploaded and processed successfully' });
};

exports.getUserNotes = async (req, res) => {
  res.json(await notes.listNotes(currentUserId(req, req.params.userId)));
};

exports.chatWithNotes = async (req, res) => {
  const { noteId, message } = req.body;
  const response = await notes.chatWithNote({ userId: currentUserId(req, req.body.userId), noteId, message });
  res.json({ response, noteId });
};

exports.summarizeNotes = async (req, res) => {
  const { noteId } = req.body;
  const summary = await notes.summarizeNote({ userId: currentUserId(req, req.body.userId), noteId });
  res.json({ summary, noteId });
};

exports.generateQuiz = async (req, res) => {
  res.json(await notes.generateNoteQuiz({ userId: currentUserId(req, req.body.userId), noteId: req.body.noteId, body: req.body }));
};

exports.saveQuizResults = async (req, res) => {
  const { noteId, quizId, userAnswers, score } = req.body;
  await notes.saveNoteQuizResult({ userId: currentUserId(req, req.body.userId), noteId, quizId, userAnswers, score });
  res.json({ success: true, message: 'Quiz results saved successfully' });
};

exports.deleteNote = async (req, res) => {
  await notes.deleteNote({ userId: currentUserId(req), noteId: req.params.noteId });
  res.json({ message: 'Note deleted successfully' });
};
