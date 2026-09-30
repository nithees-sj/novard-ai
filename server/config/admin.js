const { env } = require('./env');
const { MODELS, FAILOVER, TASKS } = require('./ai');
const EW = require('./earlyWarning');
const { badRequest } = require('../utils/httpError');

/**
 * Admin roles, the tools admins can switch on and off, and the registry of
 * runtime settings (services/settingsService.js).
 *
 * A setting's live value is layered DB > env > the default here. Every value
 * is checked by its validator before it is saved, so a bad value can never
 * reach the code that reads it.
 */

const ROLES = ['student', 'admin', 'superadmin'];
const ADMIN_ROLES = ['admin', 'superadmin'];
const STATUSES = ['active', 'suspended'];

/**
 * Student-facing tools with an on/off switch. `area` links a tool to the risk
 * area its problems are reported under.
 */
const TOOLS = {
  notes: { label: 'Notes & PDF chat', area: 'notes' },
  videoSummarizer: { label: 'Video Summarizer', area: 'video-summarizer' },
  videoLibrary: { label: 'Video Library', area: 'video-library' },
  doubts: { label: 'Doubt Clearance', area: 'doubts' },
  quizzes: { label: 'Quizzes', area: 'quizzes' },
  skillUnlocker: { label: 'Skill Unlocker', area: 'skill-unlocker' },
  roadmap: { label: 'Smart Roadmap', area: 'roadmap' },
  skillGap: { label: 'Skill Gap coach', area: 'skill-gap' },
  forumAi: { label: 'AI Forum replies', area: 'forum' },
  agent: { label: 'Novard Agent', area: 'agent' },
  reports: { label: 'Problem reports', area: 'other' },
  voiceReports: { label: 'Voice notes on reports', area: 'other' },
};

/**
 * Every AI feature, as tagged on its model calls (ai/aiContext.js). `tool` is
 * the switch that turns it off; `essential: false` features are the ones
 * paused when the global daily spend cap is reached.
 */
const AI_FEATURES = {
  'notes.chat': { tool: 'notes', area: 'notes', essential: true },
  'notes.summary': { tool: 'notes', area: 'notes', essential: true },
  'notes.quiz': { tool: 'quizzes', area: 'quizzes', essential: true },
  'video.chat': { tool: 'videoSummarizer', area: 'video-summarizer', essential: true },
  'video.summary': { tool: 'videoSummarizer', area: 'video-summarizer', essential: true },
  'video.quiz': { tool: 'quizzes', area: 'quizzes', essential: true },
  'library.keywords': { tool: 'videoLibrary', area: 'video-library', essential: false },
  'library.courses': { tool: 'videoLibrary', area: 'video-library', essential: false },
  'doubts.chat': { tool: 'doubts', area: 'doubts', essential: true },
  'doubts.summary': { tool: 'doubts', area: 'doubts', essential: true },
  'doubts.quiz': { tool: 'quizzes', area: 'quizzes', essential: true },
  'doubts.videos': { tool: 'doubts', area: 'doubts', essential: false },
  'doubts.title': { tool: 'doubts', area: 'doubts', essential: false },
  'skillplan.create': { tool: 'skillUnlocker', area: 'skill-unlocker', essential: true },
  'skillplan.quiz': { tool: 'quizzes', area: 'quizzes', essential: true },
  'roadmap.generate': { tool: 'roadmap', area: 'roadmap', essential: true },
  'skillgap.analyse': { tool: 'skillGap', area: 'skill-gap', essential: true },
  'skillgap.coach': { tool: 'skillGap', area: 'skill-gap', essential: true },
  'forum.ai': { tool: 'forumAi', area: 'forum', essential: false },
  'agent.chat': { tool: 'agent', area: 'agent', essential: true },
  'agent.action': { tool: 'agent', area: 'agent', essential: true },
  'agent.title': { tool: 'agent', area: 'agent', essential: false },
  'reports.transcribe': { tool: 'voiceReports', area: 'other', essential: true },
  'reports.enrich': { tool: 'reports', area: 'other', essential: false },
  'reports.embed': { tool: 'reports', area: 'other', essential: false },
  'risk.investigation': { tool: null, area: null, essential: false, admin: true },
  'admin.assistant': { tool: null, area: null, essential: true, admin: true },
  'admin.test': { tool: null, area: null, essential: true, admin: true },
};

// ── validators ─────────────────────────────────────────────────────────────
// Each takes the proposed value and returns the cleaned value or throws a 400.

const fail = (label, rule) => { throw badRequest(`${label} ${rule}.`); };

const v = {
  bool: () => (x, label) => (typeof x === 'boolean' ? x : fail(label, 'must be true or false')),
  str: (max = 300) => (x, label) => {
    if (x === null || x === undefined) return '';
    if (typeof x !== 'string') fail(label, 'must be text');
    const out = x.trim();
    return out.length <= max ? out : fail(label, `must be ${max} characters or fewer`);
  },
  int: (min, max) => (x, label) => (Number.isInteger(x) && x >= min && x <= max ? x : fail(label, `must be a whole number from ${min} to ${max}`)),
  num: (min, max) => (x, label) => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : fail(label, `must be a number from ${min} to ${max}`)),
  oneOf: (options) => (x, label) => (options.includes(x) ? x : fail(label, `must be one of: ${options.join(', ')}`)),
  modelId: () => (x, label) => (typeof x === 'string' && /^[\w./:-]{2,100}$/.test(x) ? x : fail(label, 'must be a model id')),
  list: (item, { min = 0, max = 50 } = {}) => (x, label) => {
    if (!Array.isArray(x) || x.length < min || x.length > max) fail(label, `must be a list of ${min} to ${max} items`);
    return x.map((el, i) => item(el, `${label}[${i}]`));
  },
  date: () => (x, label) => {
    if (x === null || x === undefined || x === '') return null;
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? fail(label, 'must be a date') : d.toISOString();
  },
  /** An object with exactly these fields; missing fields keep their current value. */
  shape: (fields) => (x, label, current = {}) => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) fail(label, 'must be an object');
    const unknown = Object.keys(x).filter((k) => !fields[k]);
    if (unknown.length) fail(label, `has unknown field(s): ${unknown.join(', ')}`);
    const out = {};
    Object.entries(fields).forEach(([k, check]) => {
      const value = k in x ? x[k] : current?.[k];
      out[k] = check(value, `${label}.${k}`, current?.[k]);
    });
    return out;
  },
};

/** An ordered threshold set: MEDIUM < HIGH < CRITICAL. */
const levels = (min, max) => (x, label, current) => {
  const out = v.shape({ MEDIUM: v.num(min, max), HIGH: v.num(min, max), CRITICAL: v.num(min, max) })(x, label, current);
  if (!(out.MEDIUM < out.HIGH && out.HIGH < out.CRITICAL)) fail(label, 'must rise from MEDIUM to HIGH to CRITICAL');
  return out;
};

const areaList = (x, label) => {
  const areas = v.list(v.shape({
    id: (id, l) => (typeof id === 'string' && EW.AREA_ID.test(id) ? id : fail(l, 'must be a lowercase id like "video-summarizer"')),
    label: (s, l) => v.str(60)(s, l) || fail(l, 'is required'),
    mergedInto: (m, l) => (m === null || m === undefined || m === '' ? null : v.str(40)(m, l)),
  }), { min: 1, max: 40 })(x, label);
  const ids = new Set(areas.map((a) => a.id));
  if (ids.size !== areas.length) fail(label, 'has the same area id twice');
  EW.AREAS.forEach((a) => ids.has(a.id) || fail(label, `must keep the built-in area "${a.id}" (rename or merge it instead)`));
  areas.forEach((a) => {
    if (a.mergedInto && (!ids.has(a.mergedInto) || a.mergedInto === a.id)) fail(label, `merges "${a.id}" into an unknown area`);
  });
  return areas;
};

const featureFlag = v.shape({ enabled: v.bool(), message: v.str(300), notice: v.str(300) });
const taskRoutes = (x, label) => {
  if (!x || typeof x !== 'object' || Array.isArray(x)) fail(label, 'must be an object of task: model');
  return Object.fromEntries(Object.entries(x)
    .filter(([, model]) => model !== null && model !== '')
    .map(([task, model]) => {
      if (!TASKS[task]) fail(label, `has an unknown task "${task}"`);
      return [task, v.modelId()(model, `${label}.${task}`)];
    }));
};

/**
 * The settings registry. `critical: true` settings can only be changed by a
 * superadmin (they can take the whole app down or raise spend).
 */
const SETTINGS = {
  ...Object.fromEntries(Object.entries(TOOLS).map(([tool, { label }]) => [`features.${tool}`, {
    group: 'features',
    description: `${label}: on/off, the message shown while it is off, and an optional "we know about this issue" notice while it is on.`,
    default: () => ({ enabled: true, message: '', notice: '' }),
    validate: featureFlag,
  }])),
  'maintenance.global': {
    group: 'features',
    critical: true,
    description: 'Maintenance mode for the whole student app (sign-in and admin console keep working).',
    default: () => ({ enabled: false, message: '' }),
    validate: v.shape({ enabled: v.bool(), message: v.str(300) }),
  },
  rateLimits: {
    group: 'limits',
    critical: true,
    description: 'Requests per minute (API per IP, AI per student) and sign-in attempts per 15 minutes.',
    envVars: ['RATE_LIMIT_API_PER_MINUTE', 'RATE_LIMIT_AI_PER_MINUTE', 'RATE_LIMIT_AUTH_PER_15_MIN', 'RATE_LIMIT_ADMIN_AUTH_PER_15_MIN'],
    default: () => ({
      apiPerMinute: env.rateLimit.apiPerMinute,
      aiPerMinute: env.rateLimit.aiPerMinute,
      authPer15Minutes: env.rateLimit.authPer15Minutes,
      adminAuthPer15Minutes: env.rateLimit.adminAuthPer15Minutes,
    }),
    validate: v.shape({
      apiPerMinute: v.int(10, 100000),
      aiPerMinute: v.int(1, 10000),
      authPer15Minutes: v.int(1, 10000),
      adminAuthPer15Minutes: v.int(1, 1000),
    }),
  },
  'ai.providers': {
    group: 'ai',
    description: 'Switch an AI provider off; features that need it show a friendly "temporarily unavailable" message.',
    default: () => ({ groq: true, gemini: true }),
    validate: v.shape({ groq: v.bool(), gemini: v.bool() }),
  },
  'ai.routes': {
    group: 'ai',
    description: 'Model per task (report enrichment, investigation roles, admin assistant). Empty = the default in config/ai.js.',
    default: () => ({}),
    validate: taskRoutes,
  },
  'ai.tiers': {
    group: 'ai',
    description: 'The models behind each tier used by the existing features.',
    envVars: ['GROQ_MODEL_REASONING', 'GROQ_MODEL_FAST'],
    default: () => ({ REASONING: MODELS.REASONING, FAST: MODELS.FAST }),
    validate: v.shape({ REASONING: v.modelId(), FAST: v.modelId() }),
  },
  'ai.failover': {
    group: 'ai',
    description: 'Order to try models in when one has used up its daily quota.',
    envVars: ['GROQ_FAILOVER_REASONING', 'GROQ_FAILOVER_FAST'],
    default: () => ({ REASONING: FAILOVER.REASONING, FAST: FAILOVER.FAST }),
    validate: v.shape({ REASONING: v.list(v.modelId(), { min: 1, max: 6 }), FAST: v.list(v.modelId(), { min: 1, max: 6 }) }),
  },
  'ai.params': {
    group: 'ai',
    description: 'reasoning_effort for gpt-oss models, a multiplier on every max_tokens, and an optional temperature for all calls.',
    default: () => ({ reasoningEffort: 'low', maxTokensScale: 1, temperature: null }),
    validate: v.shape({
      reasoningEffort: v.oneOf(['low', 'medium', 'high']),
      maxTokensScale: v.num(0.25, 2),
      temperature: (x, label) => (x === null || x === undefined || x === '' ? null : v.num(0, 2)(x, label)),
    }),
  },
  'ai.limits': {
    group: 'ai',
    critical: true,
    description: 'Per-student AI requests per day and a global daily USD cap (0 = off). At the cap, non-essential AI features pause.',
    default: () => ({ perStudentDaily: 0, globalDailyUsdCap: 0 }),
    validate: v.shape({ perStudentDaily: v.int(0, 100000), globalDailyUsdCap: v.num(0, 10000) }),
  },
  'gateways.youtube': {
    group: 'gateways',
    description: 'YouTube search, captions and metadata.',
    default: () => ({ enabled: true }),
    validate: v.shape({ enabled: v.bool() }),
  },
  reports: {
    group: 'reports',
    description: 'Open reports a student may have per area, and the app areas reports and risk are counted against.',
    default: () => ({ maxOpenPerArea: EW.REPORTS.maxOpenPerArea, areas: EW.AREAS.map((a) => ({ ...a, mergedInto: null })) }),
    validate: v.shape({ maxOpenPerArea: v.int(1, 20), areas: areaList }),
  },
  'risk.thresholds': {
    group: 'risk',
    description: 'Fixed score thresholds (cold start), percentile cut-offs, and how many scored windows percentiles need.',
    default: () => JSON.parse(JSON.stringify(EW.THRESHOLDS)),
    validate: v.shape({ fixed: levels(0.01, 0.999), percentiles: levels(50, 99.9), minScoredWindows: v.int(10, 100000) }),
  },
  'risk.coldStart': {
    group: 'risk',
    description: 'Minimum baseline history and daily event counts before a rate metric is trusted.',
    default: () => ({ ...EW.COLD_START }),
    validate: v.shape({ minBaselineActiveDays: v.int(1, 21), minDailyReports: v.int(1, 100), minDailyCalls: v.int(1, 10000) }),
  },
  'risk.budget': {
    group: 'risk',
    critical: true,
    description: 'Per-investigation budget and how many lanes may call a model at once (Groq allows ~8k tokens/minute per model).',
    default: () => ({ ...EW.BUDGET }),
    validate: v.shape({ usdMax: v.num(0.001, 5), tokensMax: v.int(2000, 500000), laneConcurrency: v.int(1, 5) }),
  },
  'risk.autoInvestigate': {
    group: 'risk',
    description: 'Run an investigation automatically for newly raised alerts during a scheduled rescan.',
    default: () => ({ ...EW.AUTO_INVESTIGATE }),
    validate: v.shape({ enabled: v.bool(), maxPerRescan: v.int(1, 13) }),
  },
  assistant: {
    group: 'ai',
    description: 'Admin assistant: USD cap per turn and model steps per turn.',
    default: () => ({ turnUsdMax: 0.01, maxSteps: 5 }),
    validate: v.shape({ turnUsdMax: v.num(0.0005, 1), maxSteps: v.int(1, 8) }),
  },
  'banners.dashboard': {
    group: 'announcements',
    description: 'A banner on every student\'s dashboard.',
    default: () => ({ enabled: false, title: '', body: '', until: null }),
    validate: v.shape({ enabled: v.bool(), title: v.str(120), body: v.str(600), until: v.date() }),
  },
};

module.exports = { ROLES, ADMIN_ROLES, STATUSES, TOOLS, AI_FEATURES, SETTINGS, validators: v };
