const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Report = require('../models/report');
const User = require('../models/user');
const settings = require('./settingsService');
const audit = require('./auditService');
const { notify } = require('./notificationService');
const { resolveArea, routeByKeywords, areaLabel, areaLabels } = require('./reportAreas');
const { REPORTS } = require('../config/earlyWarning');
const { toStoredPath, resolveStoredPath, removeUpload } = require('../utils/uploads');
const { badRequest, notFound, conflict, unsupportedMediaType, HttpError } = require('../utils/httpError');
const { text, integer, oneOf, isObjectId } = require('../utils/validate');
const logger = require('../utils/logger');
const { runWithAi } = require('../ai/aiContext');

/**
 * Student problem reports (EWDI's tickets, in Novard terms): submitting one,
 * the student's own view, and everything admins do with them. resolveReports()
 * is the one way reports get resolved: the console, bulk resolve by area,
 * approved recommendations and the admin assistant all call it.
 */

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const OPEN_STATUSES = ['open', 'in_progress'];

// ── quota ──────────────────────────────────────────────────────────────────

function quotaExceeded(areaName, max, existingRef) {
  return new HttpError(429, `You already have ${max} open report${max === 1 ? '' : 's'} about ${areaName}. `
    + `Please add to your existing report${existingRef ? ` (${existingRef})` : ''} instead.`, {
    code: 'REPORT_QUOTA', details: { existingRef: existingRef || null },
  });
}

/** Throw the friendly 429 if the student has no free slot in this area. Cheap: one indexed count. */
async function assertQuota(userId, area) {
  const { maxOpenPerArea } = await settings.get('reports');
  const open = await Report.find({ userId, area, open: true }).sort({ createdAt: -1 }).select('ref').limit(maxOpenPerArea).lean();
  if (open.length >= maxOpenPerArea) throw quotaExceeded(await areaLabel(area), maxOpenPerArea, open[0]?.ref);
}

/**
 * Route middleware: the quota is checked BEFORE the multipart body is parsed,
 * so a student over quota never uploads a file or causes a model call.
 * The area comes from the query string (?area=), which the report form sets.
 */
function checkQuotaFirst() {
  return async (req, res, next) => {
    try {
      const requested = typeof req.query.area === 'string' ? req.query.area : 'other';
      const area = await resolveArea(requested);
      if (!area) throw badRequest('Choose which part of the app the problem is in.');
      await assertQuota(req.user.email, area);
      req.reportArea = area;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

// ── files ──────────────────────────────────────────────────────────────────

async function readHead(file, n = 16) {
  const handle = await fs.promises.open(file, 'r');
  try {
    const buffer = Buffer.alloc(n);
    const { bytesRead } = await handle.read(buffer, 0, n, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** What the file's first bytes say it is, whatever the browser claimed. */
const SNIFF = {
  screenshot: (b) => (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && 'image/png')
    || (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && 'image/jpeg')
    || (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' && 'image/webp'),
  voice: (b) => (b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && 'audio/webm')
    || (b.toString('latin1', 0, 4) === 'OggS' && 'audio/ogg')
    || ((b.toString('latin1', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) && 'audio/mpeg')
    || (b.toString('latin1', 4, 8) === 'ftyp' && 'audio/mp4')
    || (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WAVE' && 'audio/wav'),
  pdf: (b) => b.toString('latin1', 0, 5) === '%PDF-' && 'application/pdf',
};
const EXTENSION = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/wav': '.wav', 'application/pdf': '.pdf',
};
const KIND_LABEL = { screenshot: 'The screenshot must be a PNG, JPEG or WebP image.', voice: 'The voice note must be WebM, Ogg, MP3, M4A or WAV audio.', pdf: 'The attachment must be a PDF.' };

/** Uploaded files as { kind, file } (multer .fields()). */
const uploadedFiles = (files = {}) => ['screenshot', 'voice', 'pdf']
  .flatMap((kind) => (files[kind] || []).slice(0, 1).map((file) => ({ kind, file })));

async function removeFiles(items) {
  await Promise.all(items.map(({ file }) => removeUpload(file.path)));
}

/** Check every file's real type and give it a matching extension. */
const MAX_BYTES = { screenshot: REPORTS.maxScreenshotBytes, voice: REPORTS.maxVoiceBytes, pdf: REPORTS.maxPdfBytes };

async function verifyFiles(items) {
  const out = [];
  for (const { kind, file } of items) {
    if (file.size > MAX_BYTES[kind]) throw new HttpError(413, `The ${kind === 'pdf' ? 'PDF' : kind} is too large (max ${Math.round(MAX_BYTES[kind] / 1048576)} MB).`);
    // eslint-disable-next-line no-await-in-loop
    const mime = SNIFF[kind](await readHead(file.path));
    if (!mime) throw unsupportedMediaType(KIND_LABEL[kind]);
    const renamed = file.path.replace(/\.[^./\\]*$/, '') + EXTENSION[mime];
    // eslint-disable-next-line no-await-in-loop
    if (renamed !== file.path) await fs.promises.rename(file.path, renamed);
    file.path = renamed;
    out.push({ kind, path: toStoredPath(renamed), mime, size: file.size, originalName: String(file.originalname || '').slice(0, 200) });
  }
  return out;
}

// ── what the report is about ───────────────────────────────────────────────

/**
 * Items a report can point at: the model, who owns it, and where its AI text
 * lives. The server copies the text itself; the client's copy is used only
 * when the item cannot be found, and is then marked unverified.
 */
const SOURCES = {
  note_chat: { model: () => require('../models/notes'), owner: 'userId', list: 'chatHistory' },
  note_summary: { model: () => require('../models/notes'), owner: 'userId', field: 'summary' },
  doubt_chat: { model: () => require('../models/doubtClearance'), owner: 'userId', list: 'chatHistory' },
  doubt_summary: { model: () => require('../models/doubtClearance'), owner: 'userId', field: 'summary' },
  video_chat: { model: () => require('../models/youtubeVideo'), owner: 'userId', list: 'chatHistory' },
  video_summary: { model: () => require('../models/youtubeVideo'), owner: 'userId', field: 'summary' },
  agent_message: { model: () => require('../models/chatbotConversation'), owner: 'userId', list: 'messages' },
  skillgap_message: { model: () => require('../models/skillGapSession'), owner: 'userId', list: 'messages' },
  roadmap: { model: () => require('../models/roadmap'), owner: 'userId', field: 'summary' },
  forum_comment: { model: () => require('../models/forumComment'), owner: null, field: 'content' },
  note_quiz: { model: () => require('../models/notes'), owner: 'userId', search: true },
  doubt_quiz: { model: () => require('../models/doubtClearance'), owner: 'userId', search: true },
  video_quiz: { model: () => require('../models/youtubeVideo'), owner: 'userId', search: true },
  plan_quiz: { model: () => require('../models/skillPlan'), owner: 'userId', search: true },
};

const collapse = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Every string inside a document (quiz questions and options included). */
function docStrings(value, out = [], depth = 0) {
  if (depth > 8 || out.length > 5000) return out;
  if (typeof value === 'string') out.push(collapse(value));
  else if (Array.isArray(value)) value.forEach((v) => docStrings(v, out, depth + 1));
  else if (value && typeof value === 'object' && !(value instanceof Date) && !value._bsontype) Object.values(value).forEach((v) => docStrings(v, out, depth + 1));
  return out;
}

async function resolveSource(userId, raw = {}) {
  const source = {
    page: text(raw.page, 'Page', { required: false, max: 200 }),
    tool: text(raw.tool, 'Tool', { required: false, max: 60 }),
  };
  const itemType = raw.itemType ? oneOf(raw.itemType, 'Item type', Object.keys(SOURCES)) : '';
  const clientExcerpt = text(raw.excerpt, 'Excerpt', { required: false, max: REPORTS.excerptMax, collapse: false });
  if (!itemType) return { ...source, ...(clientExcerpt ? { excerpt: clientExcerpt, excerptVerified: false } : {}) };

  const def = SOURCES[itemType];
  const itemId = String(raw.itemId || '');
  const messageIndex = raw.messageIndex === undefined || raw.messageIndex === null || raw.messageIndex === ''
    ? undefined : integer(raw.messageIndex, 'Message index', { min: 0, max: 100000 });
  Object.assign(source, { itemType, itemId: itemId.slice(0, 100), ...(messageIndex !== undefined ? { messageIndex } : {}) });

  let doc = null;
  if (isObjectId(itemId)) {
    doc = await def.model().findOne({ _id: itemId, ...(def.owner ? { [def.owner]: userId } : {}) }).lean();
  }
  if (!doc) return { ...source, ...(clientExcerpt ? { excerpt: clientExcerpt, excerptVerified: false } : {}) };

  let excerpt = '';
  if (def.field) excerpt = doc[def.field] || '';
  if (def.list && messageIndex !== undefined) {
    const message = (doc[def.list] || [])[messageIndex];
    if (message && message.role !== 'user') {
      excerpt = message.content || '';
      if (message._id) source.messageId = String(message._id);
    }
  }
  if (def.search && clientExcerpt) {
    // Quiz questions: accept the client's text only if it is really in this item.
    const needle = collapse(clientExcerpt).slice(0, 200);
    excerpt = needle && docStrings(doc).some((s) => s.includes(needle)) ? clientExcerpt : '';
  }
  if (excerpt) return { ...source, excerpt: String(excerpt).slice(0, REPORTS.excerptMax), excerptVerified: true };
  return { ...source, ...(clientExcerpt ? { excerpt: clientExcerpt, excerptVerified: false } : {}) };
}

// ── creating a report ──────────────────────────────────────────────────────

const newRef = () => `NV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

/** Insert, taking the first free quota slot in the area (race-free via the unique partial index). */
async function insertWithSlot(fields, max) {
  for (let slot = 0; slot < max; slot += 1) {
    for (let refTry = 0; refTry < 3; refTry += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await Report.create({ ...fields, ref: newRef(), quotaSlot: slot, open: true });
      } catch (error) {
        if (error?.code !== 11000) throw error;
        if (error.keyPattern?.ref) continue; // a ref collision: draw another ref
        break; // this slot is taken: try the next one
      }
    }
  }
  return null;
}

const channelOf = (attachments) => (['voice', 'pdf', 'screenshot'].find((k) => attachments.some((a) => a.kind === k)) || 'text');

/**
 * Submit a report. The quota was already checked before the upload was
 * parsed (checkQuotaFirst); it is checked again here atomically. Transcription,
 * enrichment and embedding are best-effort: the report is saved first and
 * never lost because a model is down.
 */
async function createReport({ user, area: requestedArea, body = {}, files }) {
  const items = uploadedFiles(files);
  let saved = null;
  try {
    const reportText = text(body.text, 'Description', { min: REPORTS.textMin, max: REPORTS.textMax, collapse: false });
    const { transcribe, voiceEnabled } = require('../ai/transcribe');
    if (items.some((i) => i.kind === 'voice') && !(await voiceEnabled())) {
      throw badRequest('Voice notes are not available right now. Please type your report instead.', { code: 'VOICE_DISABLED' });
    }
    const attachments = await verifyFiles(items);
    let source = {};
    try {
      source = await resolveSource(user.email, typeof body.source === 'string' ? JSON.parse(body.source || '{}') : (body.source || {}));
    } catch (error) {
      if (error instanceof SyntaxError) throw badRequest('The report source is not valid JSON.');
      throw error;
    }

    // Where it belongs: the form's area; "other" is re-routed by keywords.
    let area = await resolveArea(requestedArea || 'other');
    if (!area) throw badRequest('Choose which part of the app the problem is in.');
    let routedBy = body.routedBy === 'context' ? 'context' : 'student';
    if (area === 'other') {
      const guess = await resolveArea(routeByKeywords(`${reportText} ${source.excerpt || ''}`) || 'other');
      if (guess && guess !== 'other') {
        area = guess;
        routedBy = 'rules';
      }
    }
    if (area !== requestedArea) await assertQuota(user.email, area); // re-routed: that area's quota applies

    const { maxOpenPerArea } = await settings.get('reports');
    const account = await User.findOne({ email: user.email }).select('name').lean();
    saved = await insertWithSlot({
      userId: user.email,
      userName: account?.name || user.name || '',
      area,
      routedBy,
      source,
      text: reportText,
      attachments,
      channel: channelOf(attachments),
    }, maxOpenPerArea);
    if (!saved) {
      const latest = await Report.findOne({ userId: user.email, area, open: true }).sort({ createdAt: -1 }).select('ref').lean();
      throw quotaExceeded(await areaLabel(area), maxOpenPerArea, latest?.ref);
    }

    // Best effort from here on: the report exists whatever happens.
    const updates = {};
    const voice = attachments.find((a) => a.kind === 'voice');
    if (voice) {
      updates.transcript = await runWithAi({ feature: 'reports.transcribe' }, () => transcribe(resolveStoredPath(voice.path))).catch((error) => {
        logger.warn('Voice note could not be transcribed', { ref: saved.ref, error: error.message });
        return '';
      });
    }
    const pdf = attachments.find((a) => a.kind === 'pdf');
    if (pdf) {
      const { extractPdfText } = require('./notesService');
      updates.pdfText = (await extractPdfText(resolveStoredPath(pdf.path)).catch(() => '')).slice(0, REPORTS.pdfTextMax);
    }
    if (Object.keys(updates).length) await Report.updateOne({ _id: saved._id }, { $set: updates });

    const current = { ...saved.toObject(), ...updates };
    await require('./reportEnrichment').enrichOne(current);
    require('./reportEmbeddings').embedReportSoon(saved._id);
    riskChanged();

    return presentForStudent(await Report.findById(saved._id).lean(), await areaLabels());
  } catch (error) {
    if (!saved) await removeFiles(items);
    throw error;
  }
}

/** Complaint counts changed: rescan risk on the next board view (required lazily: the scorer is heavy). */
const riskChanged = () => require('./earlyWarning/rescan').markStale();

// ── the student's view ─────────────────────────────────────────────────────

const REF = /^NV-[0-9A-F]{8}$/;
const cleanRef = (ref) => {
  const value = String(ref || '').trim().toUpperCase();
  if (!REF.test(value)) throw badRequest('A valid report reference (NV-XXXXXXXX) is required.');
  return value;
};

const publicNote = (n) => ({
  from: n.authorRole === 'student' ? 'you' : 'Novard team',
  authorRole: n.authorRole,
  body: n.body,
  at: n.at,
});

function presentForStudent(r, labels = {}) {
  return {
    ref: r.ref,
    area: r.area,
    areaLabel: labels[r.area] || r.area,
    status: r.status,
    text: r.text,
    transcript: r.transcript || '',
    channel: r.channel,
    attachments: (r.attachments || []).map((a, n) => ({ n, kind: a.kind, originalName: a.originalName, size: a.size, mime: a.mime })),
    source: r.source ? { page: r.source.page, itemType: r.source.itemType, excerpt: r.source.excerpt || '' } : {},
    notes: (r.notes || []).filter((n) => !n.internal).map(publicNote),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    resolvedAt: r.resolvedAt || null,
  };
}

async function listMine(userId) {
  const [reports, labels, { maxOpenPerArea }] = await Promise.all([
    Report.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
    areaLabels(),
    settings.get('reports'),
  ]);
  return { reports: reports.map((r) => presentForStudent(r, labels)), maxOpenPerArea };
}

async function findMine(userId, ref) {
  const report = await Report.findOne({ ref: cleanRef(ref), userId }).lean();
  if (!report) throw notFound('Report not found');
  return report;
}

async function getMine(userId, ref) {
  return presentForStudent(await findMine(userId, ref), await areaLabels());
}

/**
 * The student adds to their report. Adding to a resolved report reopens it,
 * if they have a free slot in that area.
 */
async function addStudentNote(user, ref, body) {
  const report = await findMine(user.email, ref);
  const note = { author: user.email, authorName: user.name || '', authorRole: 'student', body: text(body, 'Message', { max: 4000, collapse: false }), at: new Date() };
  if (report.open) {
    await Report.updateOne({ _id: report._id }, { $push: { notes: note } });
  } else {
    const { maxOpenPerArea } = await settings.get('reports');
    let reopened = false;
    for (let slot = 0; slot < maxOpenPerArea && !reopened; slot += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await Report.updateOne({ _id: report._id, open: false }, {
          $set: { status: 'open', open: true, quotaSlot: slot }, $unset: { resolvedAt: 1, resolveBatchId: 1 }, $push: { notes: note },
        });
        reopened = res.modifiedCount > 0;
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }
    if (!reopened) throw quotaExceeded(await areaLabel(report.area), maxOpenPerArea);
    riskChanged();
  }
  return getMine(user.email, report.ref);
}

/** An attachment file of the student's own report. */
async function attachmentFor(filter, n) {
  const report = await Report.findOne(filter).select('attachments').lean();
  if (!report) throw notFound('Report not found');
  const index = integer(n, 'Attachment', { min: 0, max: 10 });
  const attachment = report.attachments?.[index];
  if (!attachment) throw notFound('Attachment not found');
  const file = resolveStoredPath(attachment.path);
  if (!fs.existsSync(file)) throw notFound('This attachment is no longer stored on the server.');
  return { file, mime: attachment.mime, name: attachment.originalName || path.basename(file) };
}

const myAttachment = (userId, ref, n) => attachmentFor({ ref: cleanRef(ref), userId }, n);

// ── admin ──────────────────────────────────────────────────────────────────

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function presentForAdmin(r, labels = {}) {
  return {
    ...presentForStudent(r, labels),
    _id: r._id,
    studentName: r.userName || 'Student',
    routedBy: r.routedBy,
    source: r.source || {},
    pdfText: r.pdfText ? r.pdfText.slice(0, 2000) : '',
    enrichment: r.enrichment || {},
    assignedTo: r.assignedTo || null,
    firstResponseAt: r.firstResponseAt || null,
    topicId: r.topicId || null,
    notes: (r.notes || []).map((n) => ({ ...n })),
    demo: Boolean(r.demo),
  };
}

/** The admin inbox: filters by area, status, urgency, intent, date and text. */
async function listForAdmin(query = {}) {
  const filter = {};
  if (query.area) filter.area = text(query.area, 'Area', { max: 40 });
  if (query.status) filter.status = { $in: String(query.status).split(',').map((s) => oneOf(s, 'Status', STATUSES)) };
  if (query.urgency) filter['enrichment.urgency'] = oneOf(query.urgency, 'Urgency', ['low', 'medium', 'high']);
  if (query.intent) filter['enrichment.intent'] = text(query.intent, 'Intent', { max: 40 });
  if (query.assignedTo) filter.assignedTo = text(query.assignedTo, 'Assignee', { max: 200 });
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if ((from && !Number.isNaN(+from)) || (to && !Number.isNaN(+to))) {
    filter.createdAt = {};
    if (from && !Number.isNaN(+from)) filter.createdAt.$gte = from;
    if (to && !Number.isNaN(+to)) filter.createdAt.$lte = to;
  }
  const q = text(query.q, 'Search', { required: false, max: 200 });
  if (q) {
    if (REF.test(q.toUpperCase())) filter.ref = q.toUpperCase();
    else filter.$or = [{ text: new RegExp(escapeRegex(q), 'i') }, { transcript: new RegExp(escapeRegex(q), 'i') }, { userName: new RegExp(escapeRegex(q), 'i') }];
  }
  const limit = integer(query.limit, 'Limit', { min: 1, max: 200, required: false, fallback: 50 });
  const page = integer(query.page, 'Page', { min: 1, max: 10000, required: false, fallback: 1 });
  const [reports, total, labels] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Report.countDocuments(filter),
    areaLabels(),
  ]);
  return { reports: reports.map((r) => presentForAdmin(r, labels)), total, page, limit };
}

async function findByRef(ref) {
  const report = await Report.findOne({ ref: cleanRef(ref) }).lean();
  if (!report) throw notFound('Report not found');
  return report;
}

async function getForAdmin(ref) {
  const report = await findByRef(ref);
  return presentForAdmin(report, await areaLabels());
}

/** The reporting student's email, for an admin who needs to contact them. Audited. */
async function revealEmail(actor, ref, { ip } = {}) {
  const report = await findByRef(ref);
  await audit.record({ actor, action: 'report.reveal_email', target: { type: 'report', id: report.ref }, after: { student: report.userName || '' }, ip });
  return { email: report.userId };
}

/**
 * Resolve (or close) reports: by refs, or everything open in an area. Only
 * reports still open or in progress are touched, and each affected student
 * gets exactly ONE notification, however many of their reports this resolved.
 * Two resolves racing on the same reports notify once: each report is claimed
 * by exactly one call (its batch id).
 */
async function resolveReports({ refs, area, note, status = 'resolved', actor, ip }) {
  const finalStatus = oneOf(status, 'Status', ['resolved', 'closed']);
  const message = text(note, 'Note', { required: false, max: 2000, collapse: false });
  const filter = { status: { $in: OPEN_STATUSES } };
  if (Array.isArray(refs) && refs.length) {
    if (refs.length > 500) throw badRequest('Resolve at most 500 reports at a time.');
    filter.ref = { $in: refs.map(cleanRef) };
  } else if (area) {
    filter.area = text(area, 'Area', { max: 40 });
  } else {
    throw badRequest('Say which reports to resolve (refs) or which area.');
  }

  const now = new Date();
  const batchId = crypto.randomBytes(8).toString('hex');
  const actorEmail = typeof actor === 'string' ? actor : actor?.email;
  const update = {
    $set: { status: finalStatus, open: false, resolvedAt: now, resolveBatchId: batchId },
    $unset: { quotaSlot: 1 },
  };
  if (message) update.$push = { notes: { author: actorEmail, authorName: actor?.name || 'Novard team', authorRole: 'admin', body: message, internal: false, at: now } };
  await Report.updateMany(filter, update);
  await Report.updateMany({ resolveBatchId: batchId, firstResponseAt: null }, { $set: { firstResponseAt: now } });

  const changed = await Report.find({ resolveBatchId: batchId }).select('ref userId area').lean();
  if (changed.length) riskChanged();
  const labels = await areaLabels();
  const byStudent = new Map();
  changed.forEach((r) => byStudent.set(r.userId, [...(byStudent.get(r.userId) || []), r]));
  await notify([...byStudent.entries()].map(([userId, list]) => {
    const areasHit = [...new Set(list.map((r) => labels[r.area] || r.area))];
    const what = finalStatus === 'closed' ? 'closed' : 'resolved';
    return {
      userId,
      kind: 'report_resolved',
      title: list.length === 1
        ? `Your ${areasHit[0]} report has been ${what}`
        : `${list.length} of your reports have been ${what}`,
      body: message ? `What we did: ${message}` : 'Thank you for letting us know.',
      reportRefs: list.map((r) => r.ref),
      link: list.length === 1 ? `/reports/${list[0].ref}` : '/reports',
    };
  }));

  await audit.record({
    actor,
    action: 'report.resolve',
    target: filter.ref ? { type: 'reports', id: changed.map((r) => r.ref).join(',').slice(0, 200) } : { type: 'area', id: filter.area },
    after: { status: finalStatus, count: changed.length, students: byStudent.size, note: message || null },
    ip,
  });
  return { resolved: changed.length, students: byStudent.size, refs: changed.map((r) => r.ref) };
}

/** Change a report's status. Resolving goes through resolveReports (one notification). */
async function setStatus(actor, ref, status, { note, ip } = {}) {
  const next = oneOf(status, 'Status', STATUSES);
  const report = await findByRef(ref);
  if (next === 'resolved' || next === 'closed') {
    if (!report.open) throw conflict(`This report is already ${report.status}.`);
    await resolveReports({ refs: [report.ref], note, status: next, actor, ip });
    return getForAdmin(report.ref);
  }
  if (!report.open) throw conflict('Reopening is done by the student adding to their report.');
  const update = { $set: { status: next } };
  if (next === 'in_progress' && !report.firstResponseAt) update.$set.firstResponseAt = new Date();
  await Report.updateOne({ _id: report._id }, update);
  await audit.record({ actor, action: 'report.status', target: { type: 'report', id: report.ref }, before: { status: report.status }, after: { status: next }, ip });
  return getForAdmin(report.ref);
}

/** An admin note: internal, or a reply the student sees (and is notified about). */
async function addAdminNote(actor, ref, { body, internal = false } = {}, { ip } = {}) {
  const report = await findByRef(ref);
  const note = { author: actor.email, authorName: actor.name || 'Novard team', authorRole: 'admin', body: text(body, 'Note', { max: 4000, collapse: false }), internal: internal === true, at: new Date() };
  const update = { $push: { notes: note } };
  if (!note.internal && !report.firstResponseAt) update.$set = { firstResponseAt: note.at };
  await Report.updateOne({ _id: report._id }, update);
  if (!note.internal) {
    await notify({
      userId: report.userId,
      kind: 'report_reply',
      title: `The Novard team replied to your report ${report.ref}`,
      body: note.body.slice(0, 300),
      reportRefs: [report.ref],
      link: `/reports/${report.ref}`,
    });
  }
  await audit.record({ actor, action: note.internal ? 'report.note.internal' : 'report.reply', target: { type: 'report', id: report.ref }, after: { body: note.body.slice(0, 500) }, ip });
  return getForAdmin(report.ref);
}

/** Assign a report to an admin (or nobody). */
async function assign(actor, ref, assignee, { ip } = {}) {
  const report = await findByRef(ref);
  let email = null;
  if (assignee) {
    email = text(assignee, 'Assignee', { max: 200 }).toLowerCase();
    const admin = await User.findOne({ email, role: { $in: ['admin', 'superadmin'] }, status: 'active' }).select('email').lean();
    if (!admin) throw badRequest('Reports can only be assigned to an active admin.');
  }
  await Report.updateOne({ _id: report._id }, email ? { $set: { assignedTo: email } } : { $unset: { assignedTo: 1 } });
  await audit.record({ actor, action: 'report.assign', target: { type: 'report', id: report.ref }, before: { assignedTo: report.assignedTo || null }, after: { assignedTo: email }, ip });
  return getForAdmin(report.ref);
}

const adminAttachment = (ref, n) => attachmentFor({ ref: cleanRef(ref) }, n);

module.exports = {
  STATUSES,
  checkQuotaFirst,
  assertQuota,
  createReport,
  listMine,
  getMine,
  addStudentNote,
  myAttachment,
  listForAdmin,
  getForAdmin,
  revealEmail,
  resolveReports,
  setStatus,
  addAdminNote,
  assign,
  adminAttachment,
  cleanRef,
  presentForAdmin,
  _internal: { resolveSource, SNIFF, insertWithSlot },
};
