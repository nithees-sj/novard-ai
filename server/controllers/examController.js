const exams = require('../services/examService');
const { currentUserId } = require('../middleware/auth');

/**
 * Exam Autopilot. The owner is always the signed-in student; `today` is their
 * local date (query or body), so days, reminders and the plan follow their clock.
 */
const me = (req) => currentUserId(req);
const today = (req) => req.query.today || req.body?.today;

exports.list = async (req, res) => {
  res.json({ exams: await exams.listExams(me(req), today(req)) });
};

exports.get = async (req, res) => {
  res.json(await exams.getExam(me(req), req.params.id, today(req)));
};

exports.draft = async (req, res) => {
  const { noteId, syllabus, title, examDate } = req.body || {};
  res.status(201).json(await exams.draftExam({ userId: me(req), file: req.file, noteId: noteId || undefined, syllabus, title, examDate: examDate || undefined, today: today(req) }));
};

exports.activate = async (req, res) => {
  res.json(await exams.activateExam({ userId: me(req), id: req.params.id, body: req.body || {}, today: today(req) }));
};

exports.update = async (req, res) => {
  res.json(await exams.updateExamSettings({ userId: me(req), id: req.params.id, body: req.body || {}, today: today(req) }));
};

exports.remove = async (req, res) => {
  res.json(await exams.deleteExam(me(req), req.params.id));
};

exports.setTask = async (req, res) => {
  res.json(await exams.setTaskStatus({ userId: me(req), id: req.params.id, taskId: req.params.taskId, status: req.body?.status, today: today(req) }));
};

exports.taskQuiz = async (req, res) => {
  res.status(201).json(await exams.startTaskQuiz({ userId: me(req), id: req.params.id, taskId: req.params.taskId, today: today(req) }));
};

exports.mock = async (req, res) => {
  res.status(201).json(await exams.startMock({ userId: me(req), id: req.params.id, kind: req.body?.kind, today: today(req) }));
};

exports.getQuiz = async (req, res) => {
  res.json(await exams.getQuiz({ userId: me(req), id: req.params.id, quizId: req.params.quizId }));
};

exports.submitQuiz = async (req, res) => {
  res.json(await exams.submitQuiz({ userId: me(req), id: req.params.id, quizId: req.params.quizId, answers: req.body?.answers, today: today(req) }));
};

exports.tutor = async (req, res) => {
  res.json(await exams.tutorChat({ userId: me(req), id: req.params.id, message: req.body?.message, topicId: req.body?.topicId || undefined, today: today(req) }));
};

exports.clearTutor = async (req, res) => {
  res.json(await exams.clearTutor({ userId: me(req), id: req.params.id }));
};
