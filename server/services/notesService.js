const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const Notes = require('../models/notes');
const { MODELS } = require('../config/ai');
const { MARKDOWN_WITH_FLOWCHART } = require('../config/prompts');
const { complete } = require('../ai/groqClient');
const { converse } = require('../ai/conversation');
const { recognizePage } = require('./ocrService');
const { readQuizOptions, generateQuiz } = require('./quizService');
const { condenseToFit } = require('../ai/condense');
const { chunkText, relevantText, sampleContent } = require('../utils/longText');
const { toStoredPath, removeUpload, hasSignature } = require('../utils/uploads');
const { badRequest, notFound, unprocessable, unsupportedMediaType, upstreamError } = require('../utils/httpError');
const { objectId, text } = require('../utils/validate');
const logger = require('../utils/logger');
const gateway = require('./gatewayEvents');

/** Notes & Quiz: a student's PDFs, chat about them, summaries and quizzes. */

// ── reading ────────────────────────────────────────────────────────────────

/** The shape the Notes page works with (never the extracted text or the memory). */
const presentNote = (note) => ({
  _id: note._id,
  id: note._id,
  title: note.title,
  fileName: note.fileName,
  summary: note.summary || '',
  chatHistory: note.chatHistory || [],
  quizzes: note.quizzes || [],
  uploadedAt: note.uploadedAt,
  lastAccessed: note.lastAccessed,
});

async function listNotes(userId) {
  const notes = await Notes.find({ userId })
    .sort({ lastAccessed: -1 })
    .select('-extractedText -memory')
    .lean();
  return notes.map(presentNote);
}

async function findOwnNote(userId, noteId, select) {
  const query = Notes.findOne({ _id: objectId(noteId, 'note id'), userId });
  if (select) query.select(select);
  const note = await query;
  if (!note) throw notFound('Note not found');
  return note;
}

// ── upload ─────────────────────────────────────────────────────────────────

// A page whose text layer has fewer visible characters than this is treated as
// a scan (or a page number / header over a scan) and read with OCR instead.
const MIN_TEXT_LAYER_CHARS = 25;
const MAX_OCR_PAGES = 30;
// Below this Tesseract is usually reading a photo or diagram, not text.
const MIN_OCR_CONFIDENCE = 40;
const OCR_BUDGET_MS = 90 * 1000;
// A4 width at 300 DPI, the resolution Tesseract is tuned for.
const OCR_RENDER_WIDTH = 2480;

const visibleChars = (value) => String(value || '').replace(/\s/g, '').length;

/** Page numbers whose text layer is too thin to be the page's real text, up to the OCR cap. */
function pagesNeedingOcr(pages) {
  return pages.filter((page) => visibleChars(page.text) < MIN_TEXT_LAYER_CHARS).slice(0, MAX_OCR_PAGES).map((page) => page.num);
}

/** Render each page and OCR it, replacing its text in `texts` when Tesseract is confident. */
async function ocrPages(parser, pageNums, texts) {
  const started = Date.now();
  const confidences = [];
  for (const num of pageNums) {
    if (Date.now() - started > OCR_BUDGET_MS) {
      logger.warn('OCR time budget reached; remaining scanned pages were skipped', { pagesSkipped: pageNums.length - confidences.length });
      break;
    }
    try {
      // One page at a time keeps only one large bitmap in memory.
      // eslint-disable-next-line no-await-in-loop
      const shot = await parser.getScreenshot({ partial: [num], desiredWidth: OCR_RENDER_WIDTH, imageDataUrl: false, imageBuffer: true });
      const image = shot.pages[0] && shot.pages[0].data;
      if (!image) continue;
      // eslint-disable-next-line no-await-in-loop
      const { text: ocrText, confidence } = await recognizePage(image);
      confidences.push(confidence);
      if (confidence >= MIN_OCR_CONFIDENCE && visibleChars(ocrText) > visibleChars(texts.get(num))) texts.set(num, ocrText);
    } catch (error) {
      logger.warn(`OCR failed on page ${num}`, error);
    }
  }
  const meanConfidence = confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : null;
  logger.info('OCR finished', { pagesOcrd: confidences.length, meanConfidence, ms: Date.now() - started });
  gateway.record({
    gateway: 'pdf',
    operation: 'ocr',
    outcome: meanConfidence !== null && meanConfidence >= MIN_OCR_CONFIDENCE ? 'ok' : 'fail',
    latencyMs: Date.now() - started,
  });
}

/**
 * The PDF's text layer, with pages that have none (scans, photos of notes)
 * read by OCR. Typed PDFs never touch OCR, so they stay fast.
 *
 * pdf-parse v1 bundled a 2018 build of pdf.js that threw "bad XRef entry" on
 * ordinary modern PDFs (anything LibreOffice or Word produces), so uploads
 * failed for most real files. v2 uses a current pdf.js.
 */
async function extractPdfText(filePath) {
  const started = Date.now();
  let parser;
  try {
    const buffer = await fs.promises.readFile(filePath);
    parser = new PDFParse({ data: new Uint8Array(buffer) });
    const { pages, total } = await parser.getText({ pageJoiner: '' });
    const texts = new Map(pages.map((page) => [page.num, (page.text || '').trim()]));

    const scanned = pagesNeedingOcr(pages);
    if (scanned.length) await ocrPages(parser, scanned, texts);

    const text = [...texts]
      .filter(([, pageText]) => pageText)
      .map(([num, pageText]) => `${pageText}\n\n-- ${num} of ${total} --`)
      .join('\n\n')
      .trim();
    gateway.record({ gateway: 'pdf', operation: 'extract', outcome: text ? 'ok' : 'missing', latencyMs: Date.now() - started });
    return text;
  } catch (error) {
    gateway.record({ gateway: 'pdf', operation: 'extract', outcome: 'fail', latencyMs: Date.now() - started, error });
    logger.warn('PDF text extraction failed', error);
    throw unprocessable('Could not read that PDF. It may be damaged or password-protected.');
  } finally {
    if (parser && typeof parser.destroy === 'function') await parser.destroy().catch(() => {});
  }
}

/** Save an uploaded PDF as a note. The file is removed again if it cannot be used. */
async function createNote({ userId, file, title }) {
  if (!file) throw badRequest('No PDF file uploaded');
  try {
    // The browser's MIME type is only a claim; check the file really is a PDF.
    if (!(await hasSignature(file.path, '%PDF-'))) throw unsupportedMediaType('Only PDF files are allowed');

    const extractedText = await extractPdfText(file.path);
    if (!extractedText) {
      throw unprocessable('Could not find any readable text in that PDF, even with OCR. If it is a scan, try a clearer, higher-resolution copy.');
    }

    const note = await Notes.create({
      userId,
      title: text(title, 'Title', { required: false, max: 200 }) || file.originalname.slice(0, 200),
      fileName: file.originalname.slice(0, 255),
      filePath: toStoredPath(file.path),
      extractedText,
    });
    return presentNote(note.toObject());
  } catch (error) {
    await removeUpload(file.path);
    throw error;
  }
}

// ── chat, summary, quiz ────────────────────────────────────────────────────

async function chatWithNote({ userId, noteId, message }) {
  const question = text(message, 'Message', { max: 4000, collapse: false });
  const note = await findOwnNote(userId, noteId, 'title extractedText chatHistory');

  // Ground the answer in the note. Short notes go in whole; long ones contribute
  // the chunks that best match this question *and* the student's recent
  // questions, so a follow-up like "explain that more" still finds the passage.
  const recentQuestions = (note.chatHistory || []).filter((m) => m.role === 'user').slice(-2).map((m) => m.content);
  const context = relevantText(note.extractedText, [question, ...recentQuestions].join(' '));

  const system = `You are a patient tutor helping a student understand their own notes, titled "${note.title}".
Answer from the notes below. If something is not covered by the notes, say so plainly, then give a brief general explanation marked as coming from outside the notes.

NOTES:
${context}

How to answer:
- Match the length to the question: a quick question gets a short, direct answer; "explain" or "compare" gets more.
- Use GitHub-flavoured Markdown: ### headings only for longer answers, lists for steps and key points, fenced code blocks with a language tag for code.
- Quote or point to the relevant part of the notes when it helps.
- Never emit raw HTML.`;

  const reply = await converse({
    Model: Notes,
    filter: { _id: note._id, userId },
    field: 'chatHistory',
    timeKey: 'timestamp',
    system,
    input: question,
    tier: 'FAST',
    temperature: 0.5,
  });
  await Notes.updateOne({ _id: note._id }, { $set: { lastAccessed: new Date() } });
  return reply;
}

const SUMMARY_RULES = `The summary should:
1. Cover every topic in the notes, each under its own heading - do not merge or skip any
2. For each topic: explain the concept, the detail behind it, and why it matters
3. Preserve specifics from the notes (names, numbers, commands, distinctions) rather than generalising them
4. Expand on terms the notes only mention in passing, so the summary stands on its own

${MARKDOWN_WITH_FLOWCHART}`;

async function summarizeNote({ userId, noteId }) {
  const note = await findOwnNote(userId, noteId, 'title extractedText');
  // Every page is read: long notes are condensed part by part until they fit one request.
  const source = await condenseToFit(note.extractedText, { what: `set of notes titled "${note.title}"` });
  const material = source.condensed
    ? `Detailed notes on each consecutive part of the notes, in order:\n${source.text}`
    : `Notes content:\n${source.text}`;

  const summary = await complete({
    messages: [
      { role: 'system', content: `Please provide a comprehensive summary of the following notes, titled "${note.title}". ${SUMMARY_RULES}\n\n${material}` },
      { role: 'user', content: 'Please summarize these notes comprehensively.' },
    ],
    model: MODELS.FAST,
    temperature: 0.5,
  });

  // Never store a placeholder: the student would see it instead of a retry.
  if (!summary) throw upstreamError('The summary could not be generated. Please try again.');
  await Notes.updateOne({ _id: note._id }, { $set: { summary, lastAccessed: new Date() } });
  return summary;
}

async function generateNoteQuiz({ userId, noteId, body }) {
  const note = await findOwnNote(userId, noteId, 'title extractedText');
  const options = readQuizOptions(body);
  // The whole document is sampled evenly, so later pages of long notes are tested too.
  const questions = await generateQuiz({ subject: note.title, content: sampleContent(note.extractedText), options });

  const quizId = Date.now().toString();
  await Notes.updateOne(
    { _id: note._id },
    {
      $push: { quizzes: { quizId, questions, settings: options, createdAt: new Date() } },
      $set: { lastAccessed: new Date() },
    }
  );
  return { quiz: questions, quizId, noteId: String(note._id), settings: options };
}

/** Validate a submitted score: { correct, total, percentage }. */
function readScore(score) {
  if (!score || typeof score !== 'object') throw badRequest('Missing required fields');
  const total = Number(score.total);
  const correct = Number(score.correct);
  if (!Number.isInteger(total) || total < 1 || total > 100) throw badRequest('score.total must be between 1 and 100.');
  if (!Number.isInteger(correct) || correct < 0 || correct > total) throw badRequest('score.correct must be between 0 and score.total.');
  return { correct, total, percentage: Math.round((correct / total) * 100) };
}

/** Answers by question index, e.g. { "0": 2, "1": 0 }. */
function readAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw badRequest('Missing required fields');
  const entries = Object.entries(answers);
  if (entries.length > 100) throw badRequest('Too many answers.');
  return Object.fromEntries(entries
    .filter(([k, v]) => /^\d+$/.test(k) && (typeof v === 'number' || typeof v === 'string'))
    .map(([k, v]) => [k, String(v).slice(0, 20)]));
}

async function saveNoteQuizResult({ userId, noteId, quizId, userAnswers, score }) {
  if (!quizId) throw badRequest('Missing required fields');
  const cleanScore = readScore(score);
  const cleanAnswers = readAnswers(userAnswers);
  const now = new Date();
  const result = await Notes.updateOne(
    { _id: objectId(noteId, 'note id'), userId, 'quizzes.quizId': String(quizId) },
    {
      $set: {
        'quizzes.$.userAnswers': cleanAnswers,
        'quizzes.$.score': cleanScore,
        'quizzes.$.attemptedAt': now,
        lastAccessed: now,
      },
    }
  );
  if (!result.matchedCount) {
    const exists = await Notes.exists({ _id: noteId, userId });
    throw notFound(exists ? 'Quiz not found' : 'Note not found');
  }
}

async function deleteNote({ userId, noteId }) {
  const note = await Notes.findOneAndDelete({ _id: objectId(noteId, 'note id'), userId }).select('filePath').lean();
  if (!note) throw notFound('Note not found');
  await removeUpload(note.filePath);
}

module.exports = {
  extractPdfText,
  listNotes,
  createNote,
  chatWithNote,
  summarizeNote,
  generateNoteQuiz,
  saveNoteQuizResult,
  deleteNote,
  _internal: { chunkText, relevantNoteText: relevantText, readScore, readAnswers, pagesNeedingOcr, extractPdfText },
};
