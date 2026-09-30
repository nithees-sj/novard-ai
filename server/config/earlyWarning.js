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

/**
 * Percentile cut-offs never fall below these anomaly levels. With many quiet
 * windows (z = 0, score 0.12) a percentile can land on the quiet score itself,
 * which would make every quiet window MEDIUM; and P95 alone makes 1 window in
 * 20 HIGH even when nothing is wrong. Measured on the demo's quiet baseline,
 * random noise peaks at z ~ 2.9 (score 0.70), while a real incident clips at
 * z = 6; HIGH therefore needs z >= 3 (score >= 0.73).
 */
const LEVEL_MIN_Z = { MEDIUM: 1.5, HIGH: 3, CRITICAL: 4.5 };

/**
 * The complaint rule (services/earlyWarning/complaints.js): an area's level
 * from its unresolved complaints in the last `windowDays` days, whatever its
 * history. A complaint is a report whose text reads as a problem (sentiment,
 * urgency and intent from the AI triage); a severe one is urgent or very
 * negative. The higher of this level and the baseline score's level wins.
 */
const COMPLAINTS = {
  enabled: true,
  windowDays: 7,
  medium: 3, // complaints -> MEDIUM
  high: 5, // complaints -> HIGH
  severeHigh: 3, // severe complaints -> HIGH
  severeCritical: 5, // severe complaints -> CRITICAL
  // One student alone never puts an area at risk.
  minReporters: 2,
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
  minDailyGatewayEvents: 10,
};

// Scoring (EWDI app/config.py + app/risk/anomaly.py) ---------------------

const WINDOW_DAYS = 7; // the window each score describes
const BASELINE_DAYS = 28; // window + 21-day baseline before it (EWDI build_features)
const HORIZON_DAYS = 7; // the predictor's outlook
const HISTORY_DAYS = 180; // how far back scores are recomputed
// A day's reports count as "unresolved" when they had no admin response this
// long after the day ended. Younger days are left out of that metric, or every
// area would look worse on its newest days.
const RESPONSE_GRACE_HOURS = 48;

/**
 * The daily metrics per area. `kind: 'count'` treats a missing day as 0;
 * a 'rate' is used only on days where its `gate` count reaches its minimum
 * (the COLD_START minimums above, by name).
 */
const METRICS = [
  // from reports (EWDI: volume, authors, no-response, latency, sentiment, urgency, repeat)
  { name: 'n_reports', kind: 'count' },
  { name: 'n_reporters', kind: 'count' },
  { name: 'pct_unresolved', kind: 'rate', gate: 'n_reports_settled', min: 'minDailyReports' },
  { name: 'p50_first_response_h', kind: 'rate', gate: 'n_responded', min: 'minDailyReports' },
  { name: 'p90_first_response_h', kind: 'rate', gate: 'n_responded', min: 'minDailyReports' },
  { name: 'mean_sent', kind: 'rate', gate: 'n_enriched', min: 'minDailyReports', enriched: true },
  { name: 'pct_negative', kind: 'rate', gate: 'n_enriched', min: 'minDailyReports', enriched: true },
  { name: 'pct_urgent', kind: 'rate', gate: 'n_enriched', min: 'minDailyReports', enriched: true },
  { name: 'repeat_rate', kind: 'rate', gate: 'n_enriched', min: 'minDailyReports', enriched: true },
  // automatic signals Novard already produces (new, not in EWDI)
  { name: 'ai_error_rate', kind: 'rate', gate: 'n_calls', min: 'minDailyCalls' },
  { name: 'ai_429_rate', kind: 'rate', gate: 'n_calls', min: 'minDailyCalls' },
  { name: 'ai_p95_latency', kind: 'rate', gate: 'n_calls', min: 'minDailyCalls' },
  { name: 'ai_report_rate', kind: 'rate', gate: 'n_calls', min: 'minDailyCalls' },
  { name: 'gateway_failure_rate', kind: 'rate', gate: 'n_gateway', min: 'minDailyGatewayEvents' },
];

// +1 = higher is worse, -1 = lower is worse. Every feature has one.
const DIRECTIONS = {
  n_reports: +1,
  n_reporters: +1,
  pct_unresolved: +1,
  p50_first_response_h: +1,
  p90_first_response_h: +1,
  mean_sent: -1,
  pct_negative: +1,
  pct_urgent: +1,
  repeat_rate: +1,
  ai_error_rate: +1,
  ai_429_rate: +1,
  ai_p95_latency: +1,
  ai_report_rate: +1,
  gateway_failure_rate: +1,
};

// slope name -> [base metric, direction] (compared against the base metric's baseline scale)
const SLOPES = {
  volume_slope: ['n_reports', +1],
  sent_slope: ['mean_sent', -1],
  unresolved_slope: ['pct_unresolved', +1],
  ai_error_slope: ['ai_error_rate', +1],
};
const SLOPE_SERIES = [
  { name: 'volume_slope', metric: 'n_reports' },
  { name: 'sent_slope', metric: 'mean_sent', nullIfEmpty: true },
  { name: 'unresolved_slope', metric: 'pct_unresolved', nullIfEmpty: true },
  { name: 'ai_error_slope', metric: 'ai_error_rate', nullIfEmpty: true },
];

/**
 * Per-feature absolute floor on the robust-z scale. EWDI uses 1e-3 for every
 * feature; at Novard's volumes an area with a quiet baseline (median 0) would
 * turn ONE report into +6 sigma. A change must be at least this big to count.
 */
const ABS_FLOORS = {
  n_reports: 1,
  n_reporters: 1,
  pct_unresolved: 0.05,
  p50_first_response_h: 0.1,
  p90_first_response_h: 0.1,
  mean_sent: 0.1,
  pct_negative: 0.05,
  pct_urgent: 0.05,
  repeat_rate: 0.05,
  ai_error_rate: 0.02,
  ai_429_rate: 0.02,
  ai_p95_latency: 0.1,
  ai_report_rate: 1,
  gateway_failure_rate: 0.05,
};

// Plain words for the risk board ("driven by ...").
const FEATURE_LABELS = {
  n_reports: 'report volume',
  n_reporters: 'students reporting',
  pct_unresolved: 'unanswered reports',
  p50_first_response_h: 'time to first reply',
  p90_first_response_h: 'slowest replies',
  mean_sent: 'student sentiment',
  pct_negative: 'negative reports',
  pct_urgent: 'urgent reports',
  repeat_rate: 'repeat reporters',
  ai_error_rate: 'AI errors',
  ai_429_rate: 'AI rate limits',
  ai_p95_latency: 'AI slowness',
  ai_report_rate: 'AI answers reported',
  gateway_failure_rate: 'YouTube / PDF failures',
  volume_slope: 'rising report volume',
  sent_slope: 'worsening sentiment',
  unresolved_slope: 'growing backlog',
  ai_error_slope: 'rising AI errors',
};

const ANOMALY = { relFloor: 0.25, clip: 6, topK: 3 };

// Investigation graph (EWDI app/graph, app/config.py) --------------------

const GRAPH = {
  lanes: ['temporal', 'peers', 'history', 'semantic', 'telemetry'],
  maxSupervisorLoops: 3, // EWDI MAX_SUPERVISOR_LOOPS
  maxRevisions: 1, // EWDI MAX_REVISIONS
  recursionLimit: 40,
  // Small prompts: Groq allows ~8k tokens a minute per model (PLAN.md §6.4).
  laneToolChars: 1500, // tool output a lane's model reads
  laneMaxTokens: 300,
  supervisorMaxTokens: 250,
  rootCauseMaxTokens: 1200,
  verifierMaxTokens: 500,
  maxCiteIds: 40, // ids offered to root cause (EWDI: 40)
  staleRunMinutes: 15, // a run still "running" after this was interrupted
  streamMaxMinutes: 10,
};

/**
 * What an investigation may recommend. Only `flag_area` runs by itself (it is
 * internal and reversible); everything else waits for an admin's approval and
 * then runs through the same service function as the console's own control.
 */
const RECOMMENDATION_TYPES = {
  flag_area: { label: 'Flag the area on the risk board', auto: true, params: 'none' },
  known_issue_banner: { label: 'Show a "we know about this" notice on a tool', params: '{ "tool": one of the tools, "message": text }' },
  set_feature_flag: { label: 'Switch a tool off (or on) with a message', params: '{ "tool": one of the tools, "enabled": true|false, "message": text }' },
  set_model_route: { label: 'Route an AI task to another model', params: '{ "task": one of the AI tasks, "model": model id }' },
  bulk_resolve: { label: 'Resolve the area\'s open reports with a note', params: '{ "note": text for the students }' },
  broadcast: { label: 'Send an announcement', params: '{ "audience": "area_reporters" | "all", "title": text, "body": text }' },
  advice: { label: 'Advice (nothing to run)', params: 'none' },
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
  LEVEL_MIN_Z,
  COMPLAINTS,
  COLD_START,
  BUDGET,
  AUTO_INVESTIGATE,
  WINDOW_DAYS,
  BASELINE_DAYS,
  HORIZON_DAYS,
  HISTORY_DAYS,
  RESPONSE_GRACE_HOURS,
  METRICS,
  DIRECTIONS,
  SLOPES,
  SLOPE_SERIES,
  ABS_FLOORS,
  FEATURE_LABELS,
  ANOMALY,
  GRAPH,
  RECOMMENDATION_TYPES,
};
