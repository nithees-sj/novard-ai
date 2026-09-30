/**
 * The complaint rule: an area is at risk when enough students complain about
 * it, whatever its history. It runs beside the baseline scoring (which needs
 * weeks of history before a jump means anything) and the higher level wins.
 *
 * Each report is first read for what it says: a complaint, a severe complaint,
 * or not a risk at all (a suggestion, a question, praise). The AI triage in
 * reportEnrichment.js supplies sentiment, urgency and intent; until it has run
 * (or when no model is available) a small word list reads the text instead.
 * Then the area's unresolved complaints from the last few days are counted:
 * a few severe ones, or more milder ones, raise its level.
 */

const RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

// Intents that describe something wrong with the app (not a wish or a question).
const PROBLEM_INTENTS = ['bug', 'wrong_ai_answer', 'account'];

// Offline reading, only used before the AI triage has run.
const SEVERE_WORDS = /\b(not working at all|doesn'?t work at all|nothing (works|loads)|completely (broken|down|stuck)|lost (all |my )?(work|notes|data|progress)|crash(es|ed|ing)?|can'?t (use|open|upload|access|sign|log|submit|see|load)|cannot (use|open|upload|access|sign|log|submit|see|load)|unable to (use|open|upload|access|sign|log|submit|see|load)|urgent|exam (is )?(tomorrow|today))\b/i;
const PROBLEM_WORDS = /\b(not working|doesn'?t work|does not work|didn'?t work|broken|bug|error|fail(s|ed|ing)?|wrong|incorrect|stuck|freez(e|es|ing)|blank|missing|won'?t|can'?t|cannot|unable|slow|timeout|timed out|glitch|problem|issue|useless|terrible|worst|frustrat\w*|annoying|disappointed|hate)\b/i;
const WISH_WORDS = /\b(please add|would be (nice|great|good|cool)|feature request|suggest(ion)?|it would help|could you add|wish (it|there|you)|love (it|this)|thank(s| you)|great (app|tool|job))\b/i;

/**
 * What one report says, as far as risk goes.
 * @returns {'severe'|'complaint'|'none'}
 */
function verdict(report) {
  const e = report?.enrichment || {};
  if (e.status === 'done' && typeof e.sentiment === 'number') {
    const urgent = e.urgency === 'high';
    const complaint = urgent
      || (e.intent !== 'feature_request' && e.sentiment <= -0.3)
      || (PROBLEM_INTENTS.includes(e.intent) && e.urgency !== 'low');
    if (!complaint) return 'none';
    return urgent || e.sentiment <= -0.6 ? 'severe' : 'complaint';
  }
  return textVerdict([report?.text, report?.transcript].filter(Boolean).join(' '));
}

/** The offline reading of a report's words. */
function textVerdict(text) {
  const t = String(text || '');
  if (SEVERE_WORDS.test(t)) return 'severe';
  if (PROBLEM_WORDS.test(t) && !WISH_WORDS.test(t)) return 'complaint';
  return 'none';
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Complaints counted for a window ending on `windowEnd` ('YYYY-MM-DD'): made in
 * its last `windowDays` days and still unresolved when the day ended.
 * @param {Array} reports this area's reports (area, userId, createdAt, open, resolvedAt, enrichment, text, transcript)
 * @returns {{ complaints, severe, reporters }}
 */
function countWindow(reports, windowEnd, windowDays) {
  const end = Date.parse(`${windowEnd}T00:00:00Z`) + DAY_MS;
  const start = end - windowDays * DAY_MS;
  const counted = reports.filter((r) => {
    const created = new Date(r.createdAt).getTime();
    if (created < start || created >= end) return false;
    // Closed without a date (imported or old data): treated as dealt with.
    if (!r.resolvedAt) return r.open !== false;
    return new Date(r.resolvedAt).getTime() >= end;
  }).map((r) => ({ r, v: verdict(r) })).filter((x) => x.v !== 'none');
  return {
    complaints: counted.length,
    severe: counted.filter((x) => x.v === 'severe').length,
    reporters: new Set(counted.map((x) => x.r.userId)).size,
  };
}

/**
 * The level the complaints alone call for.
 * @param {{ complaints, severe, reporters }} c
 * @param {object} cfg the `risk.complaints` setting
 */
function complaintLevel(c, cfg) {
  if (!cfg?.enabled || !c || c.reporters < cfg.minReporters) return 'LOW';
  if (c.severe >= cfg.severeCritical) return 'CRITICAL';
  if (c.severe >= cfg.severeHigh || c.complaints >= cfg.high) return 'HIGH';
  if (c.complaints >= cfg.medium) return 'MEDIUM';
  return 'LOW';
}

/** The worse of two levels. */
const worse = (a, b) => (RANK[b] > RANK[a] ? b : a);

/** "5 complaints in 7 days (3 severe)": for the risk board and alerts. */
function describe(c, windowDays) {
  if (!c?.complaints) return '';
  return `${c.complaints} complaint${c.complaints === 1 ? '' : 's'} in ${windowDays} days${c.severe ? ` (${c.severe} severe)` : ''}`;
}

/**
 * The complaint count as a "driven by" entry, when it calls for MEDIUM or worse.
 * Text drivers have no z: they are shown as they are.
 */
function complaintDrivers(c) {
  if (!c?.complaints || !c.level || c.level === 'LOW') return [];
  return [{ feature: 'complaints', label: describe(c, c.windowDays || 7), text: true, complaints: c.complaints, severe: c.severe, reporters: c.reporters }];
}

module.exports = { verdict, textVerdict, countWindow, complaintLevel, complaintDrivers, worse, describe, RANK };
