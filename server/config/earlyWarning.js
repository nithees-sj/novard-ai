/**
 * Early warning: every tunable constant for reports, risk scoring and the
 * investigation graph lives here (ported from EWDI's app/config.py and tuned
 * for Novard-AI's volumes; see docs/early-warning/PLAN.md §3).
 *
 * Values an admin can change at runtime are only the *defaults* here; the live
 * value comes from settingsService (DB > env > this file).
 */

/**
 * The areas of the app that reports and risk are counted against (EWDI's
 * departments). Ids never change; labels can be renamed and areas merged or
 * added from the console (the `reports.areas` setting).
 */
const AREAS = [
  { id: 'sign-in', label: 'Sign-in & Account' },
  { id: 'notes', label: 'Notes & PDF chat' },
  { id: 'video-summarizer', label: 'Video Summarizer' },
  { id: 'video-library', label: 'Video Library' },
  { id: 'doubts', label: 'Doubt Clearance' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'skill-unlocker', label: 'Skill Unlocker' },
  { id: 'roadmap', label: 'Smart Roadmap' },
  { id: 'skill-gap', label: 'Skill Gap coach' },
  { id: 'forum', label: 'AI Forum' },
  { id: 'agent', label: 'Novard Agent' },
  { id: 'dashboard', label: 'Dashboard & Profile' },
  { id: 'other', label: 'Other' },
];

const AREA_ID = /^[a-z][a-z0-9-]{1,39}$/;

// Reports -----------------------------------------------------------------

const REPORTS = {
  // EWDI: TICKETS_PER_DEPARTMENT = 2. Counted over OPEN reports here, so a
  // student can report again once their earlier report is dealt with.
  maxOpenPerArea: 2,
  textMin: 10,
  textMax: 4000,
  excerptMax: 4000,
  pdfTextMax: 20000,
  // Upload limits (bytes). Checked by multer, then each file's first bytes.
  maxScreenshotBytes: 5 * 1024 * 1024,
  maxVoiceBytes: 10 * 1024 * 1024,
  maxPdfBytes: 10 * 1024 * 1024,
  // EWDI enrich.py: 75 per call; smaller here to stay under Groq's ~8k tokens/minute.
  enrichBatchSize: 20,
  embedBatchSize: 50,
};

/**
 * Keyword routing for a report filed under "Other" (EWDI's intake routing).
 * The report form usually knows the area from the page it was opened on;
 * this only runs when it does not. First area with a matching word wins.
 */
const AREA_KEYWORDS = [
  ['sign-in', /\b(sign(ed)?[ -]?in|log(ged)?[ -]?in|log ?out|google account|session|password|account)\b/i],
  ['video-summarizer', /\b(summar(y|ise|ize)[a-z]* (of|for) (the |a |my )?video|video summar|caption|transcript|youtube (link|video) (won'?t|doesn'?t|not))\b/i],
  ['video-library', /\b(video library|recommend(ed|ation)s? (video|course)|udemy|coursera|edureka)\b/i],
  ['notes', /\b(pdf|notes?|upload(ed|ing)?|ocr|scann?ed)\b/i],
  ['quizzes', /\b(quiz(zes)?|question|answer key|wrong option|mcq)\b/i],
  ['doubts', /\b(doubt)\b/i],
  ['skill-unlocker', /\b(skill unlocker|learning plan|day \d+|daily plan)\b/i],
  ['roadmap', /\b(roadmap)\b/i],
  ['skill-gap', /\b(skill[ -]?gap|coach|readiness)\b/i],
  ['forum', /\b(forum|discussion|comment|thread)\b/i],
  ['agent', /\b(agent|novard agent|chatbot)\b/i],
  ['dashboard', /\b(dashboard|profile|streak|analytics|study time|heatmap)\b/i],
];

// Enrichment (EWDI enrich.py, adapted). Bump the version when the prompt changes.
const ENRICH = {
  promptVersion: 'nv-enrich-v1',
  intents: ['bug', 'wrong_ai_answer', 'content_quality', 'feature_request', 'account', 'other'],
  urgencies: ['low', 'medium', 'high'],
  // A student who reported in the same area within this many days is a repeat reporter.
  repeatWindowDays: 30,
};

// Topic clustering (EWDI ingest/embed.py cluster()).
const TOPICS = {
  tau: 0.75, // cosine similarity to join an existing cluster
  minCluster: 3, // EWDI: 15, far above a Novard area's weekly volume
  maxCentroids: 50,
  windowDays: 90,
  // Re-clustering keeps a topic's id and label when its new centroid is this close.
  keepIdAbove: 0.9,
};

// Semantic lane (EWDI graph/tools.py search_similar).
const SEMANTIC = {
  // EWDI: 50 vectors before trusting cosine search over full-text.
  minVectors: 30,
  k: 12,
  vectorIndex: 'report_vec',
};

// Risk levels ---------------------------------------------------------------

const LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const THRESHOLDS = {
  // Used until there is enough history for percentiles, and always for an
  // area with too little baseline. score = sigmoid(z - 2): 0.50 is z = 2,
  // 0.82 is z ~ 3.5, 0.95 is z ~ 5.
  fixed: { MEDIUM: 0.5, HIGH: 0.82, CRITICAL: 0.95 },
  // EWDI: LEVEL_PERCENTILES
  percentiles: { MEDIUM: 85, HIGH: 95, CRITICAL: 99 },
  // Percentile cut-offs need a distribution; below this many scored windows
  // (all areas together) the fixed thresholds are used.
  minScoredWindows: 120,
};

const COLD_START = {
  // An area whose 21-day baseline has fewer active days than this is
  // `insufficient_baseline` and only ever classified by fixed thresholds.
  minBaselineActiveDays: 7,
  // EWDI: MIN_DAILY_RECORDS = 15. Novard areas see single-digit reports a
  // day; 3 is the smallest count at which a share means more than a coin flip.
  minDailyReports: 3,
  // AI / gateway rate metrics need more events to be stable.
  minDailyCalls: 20,
};

// Investigation budget (docs/early-warning/PLAN.md §6.4). Groq's free tier is
// ~8k tokens/minute per model, so the budget is sized in tokens first.
const BUDGET = {
  usdMax: 0.03,
  tokensMax: 40000,
  laneConcurrency: 2,
};

const AUTO_INVESTIGATE = { enabled: false, maxPerRescan: 2 };

module.exports = {
  AREAS,
  AREA_ID,
  REPORTS,
  AREA_KEYWORDS,
  ENRICH,
  TOPICS,
  SEMANTIC,
  LEVELS,
  THRESHOLDS,
  COLD_START,
  BUDGET,
  AUTO_INVESTIGATE,
};
