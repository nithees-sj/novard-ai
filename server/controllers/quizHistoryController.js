const Notes = require('../models/notes');
const YouTubeVideo = require('../models/youtubeVideo');
const DoubtClearance = require('../models/doubtClearance');
const SkillPlan = require('../models/skillPlan');
const { summariseAttempts } = require('../services/quizService');

/**
 * Previous quiz marks for one topic (a note, video, doubt or learning plan),
 * shown before the student starts a new quiz on it.
 *
 * Only submitted quizzes count - a quiz that was generated but never taken is
 * not a 0%. The rules match the dashboard analytics so both always agree:
 * quizzes carry attemptedAt once submitted; older records fall back to the
 * signals they had (a notes score object, a non-zero video score, a non-null
 * doubt score).
 */

const pct = (correct, total) => (total > 0 ? Math.round((Math.min(correct, total) / total) * 100) : 0);

const fromSettings = (s = {}) => ({
  difficulty: s.difficulty || null,
  questionCount: s.questionCount || null,
  style: s.style || null,
  focus: s.focus || null,
});

const SOURCES = {
  notes: {
    load: (id, userId) => Notes.findOne({ _id: id, userId }).select('title quizzes').lean(),
    topic: (doc) => doc.title,
    attempts: (doc) => (doc.quizzes || [])
      .filter((q) => Number(q.score?.total) > 0)
      .map((q) => {
        const total = Number(q.score.total);
        const correct = q.score.correct !== undefined
          ? Number(q.score.correct)
          : Math.round(((Number(q.score.percentage) || 0) / 100) * total);
        return { attemptedAt: q.attemptedAt || q.createdAt, correct, total, percentage: pct(correct, total), ...fromSettings(q.settings) };
      }),
  },

  youtube: {
    load: (id, userId) => YouTubeVideo.findOne({ _id: id, userId }).select('title quizzes').lean(),
    topic: (doc) => doc.title,
    attempts: (doc) => countBased(doc.quizzes, (q) => q.attemptedAt || Number(q.score) > 0),
  },

  doubt: {
    load: (id, userId) => DoubtClearance.findOne({ _id: id, userId }).select('title quizzes').lean(),
    topic: (doc) => doc.title,
    attempts: (doc) => countBased(doc.quizzes, (q) => q.attemptedAt || (q.score !== null && q.score !== undefined)),
  },

  plan: {
    load: (id, userId) => SkillPlan.findOne({ _id: id, userId }).select('skillName quizResults').lean(),
    topic: (doc) => doc.skillName,
    attempts: (doc) => (doc.quizResults || []).map((r) => {
      const total = Number(r.totalQuestions) || Number(r.questionCount) || 0;
      const correct = r.correctAnswers !== undefined
        ? Number(r.correctAnswers)
        : Math.round(((Number(r.score) || 0) / 100) * total);
      return {
        attemptedAt: r.completedAt,
        correct,
        total,
        percentage: total > 0 ? pct(correct, total) : Math.round(Number(r.score) || 0),
        difficulty: r.difficulty || null,
        questionCount: r.questionCount || total || null,
        style: r.style || null,
        focus: r.focus || null,
      };
    }),
  },
};

/** Video and doubt quizzes store the number of correct answers as `score`. */
function countBased(quizzes = [], taken) {
  return quizzes.filter(taken).map((q) => {
    const total = Number(q.totalQuestions) || (q.questions || []).length;
    const correct = Number(q.score) || 0;
    return {
      attemptedAt: q.attemptedAt || q.completedAt,
      correct,
      total,
      percentage: pct(correct, total),
      ...fromSettings(q.settings),
    };
  });
}

const getQuizHistory = async (req, res) => {
  try {
    const { source, itemId } = req.params;
    const userId = req.query.userId;
    const handler = SOURCES[source];

    if (!handler) {
      return res.status(400).json({ error: `Unknown quiz source "${source}"` });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const doc = await handler.load(itemId, userId).catch(() => null);
    if (!doc) {
      return res.status(404).json({ error: 'Not found' });
    }

    const attempts = handler.attempts(doc).filter((a) => a.total > 0 && a.attemptedAt);
    res.json({ source, itemId, topic: handler.topic(doc), ...summariseAttempts(attempts) });
  } catch (error) {
    console.error('Error fetching quiz history:', error);
    res.status(500).json({ error: 'Failed to fetch quiz history' });
  }
};

module.exports = { getQuizHistory };
