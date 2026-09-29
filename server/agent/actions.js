const { createDoubt } = require('../services/doubtService');
const { addYouTubeVideo } = require('../services/videoSummarizerService');
const { createRoadmapFor } = require('../services/roadmapService');
const { createSkillPlan } = require('../services/skillPlanService');
const { startSession } = require('../services/skillGapService');
const { openIssue, CATEGORIES } = require('../services/forumService');
const { searchVideos } = require('../services/youtubeService');
const { cleanPatch, updateProfile, FIELDS: PROFILE_FIELDS } = require('../services/learnerProfileService');
const DoubtClearance = require('../models/doubtClearance');
const Roadmap = require('../models/roadmap');
const SkillPlan = require('../models/skillPlan');
const SkillGapSession = require('../models/skillGapSession');
const { badRequest } = require('../utils/httpError');

/**
 * Things the Novard Agent can create in the app, and what each one needs.
 *
 * Creating something goes: clarify -> draft -> create.
 *   suggest_*  after answering a question, a small card offering a next step.
 *              "Yes" continues in the chat, where the details are gathered.
 *   prepare_*  the model passes what it knows and which details the student
 *              actually said. The server fills gaps from the learner profile,
 *              checks the requirements below and either reports what is
 *              still missing (so the agent asks) or shows a DRAFT card.
 *   Create     the student reviews and edits the draft, then presses Create;
 *              only then does it run (agent/conversations.js).
 * Each action reuses the exact function behind the matching page, so an item
 * the agent creates is identical to one made by hand.
 *
 * Fields (the draft's form and the requirements in one place):
 *   need     'must'   never assumed: from this chat or the saved profile, else the agent asks
 *            'should' from the chat or profile, else a default marked "assumed" on the draft
 *            'auto'   written by the agent (a title, tags), never asked
 *   group    at least one field of the group must be known (e.g. hours OR timeline)
 *   profile  { get(profile), set(value) } to prefill from / save to the learner profile
 */

const LANGUAGES = ['English', 'Spanish', 'French', 'Hindi', 'Tamil'];
const STYLES = ['Standard', 'Fast-paced', 'In-depth', 'Practical'];

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const list = (v, maxItems, maxLen) => (Array.isArray(v) ? v : String(v || '').split(','))
  .filter((x) => typeof x === 'string' || typeof x === 'number')
  .map((x) => clean(x, maxLen)).filter((x) => x && !/^(none|nothing|n\/a|-)$/i.test(x)).slice(0, maxItems);
const invalid = (message) => Object.assign(new Error(message), { status: 400 });
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sameText = (s) => new RegExp(`^\\s*${escapeRegex(String(s).trim())}\\s*$`, 'i');
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const opts = (...values) => values.map((v) => (Array.isArray(v) ? { value: v[0], label: v[1] } : { value: v, label: v }));

// Profile links shared by several actions.
const link = (key, get = (p) => p[key]) => ({ key, get, set: (v) => ({ [key]: v }) });
const hintOnly = (l) => ({ ...l, hintOnly: true }); // the subject of an item: offered as an option, never filled in
const readOnly = (l) => ({ ...l, set: () => ({}) }); // prefilled from the profile, but too coarse to save back
const P = {
  role: hintOnly(link('targetRole')),
  skills: link('knownSkills'),
  level3: link('level'),
  level2: readOnly(link('level', (p) => (p.level === 'experienced' ? 'intermediate' : p.level))),
  levelDoubt: readOnly(link('level', (p) => (p.level === 'experienced' ? 'advanced' : p.level))),
  hours: link('hoursPerWeek'),
  months: link('timelineMonths'),
  goal: link('goal'),
  experience: link('experience'),
  language: link('language', (p) => (LANGUAGES.includes(p.language) ? p.language : undefined)),
  style: link('teachingStyle', (p) => (STYLES.includes(p.teachingStyle) ? p.teachingStyle : undefined)),
};

// ── reading one field ──────────────────────────────────────────────────────

/**
 * A field's value from raw input: { value } when usable, { missing: true }
 * when absent or unusable, or { reason } when it was given but is out of range
 * (so the student can be asked instead of it being silently changed).
 */
function readField(f, raw) {
  if (raw === undefined || raw === null || raw === '') return { missing: true };
  switch (f.type) {
    case 'int': {
      const n = typeof raw === 'number' ? Math.round(raw) : parseInt(String(raw), 10);
      if (!Number.isFinite(n)) return { missing: true };
      if (n < f.min || n > f.max) return { reason: `${f.label} must be between ${f.min} and ${f.max} (got ${n}).` };
      return { value: n };
    }
    case 'select': {
      const s = String(raw).trim().toLowerCase();
      const hit = f.options.find((o) => String(o.value).toLowerCase() === s || o.label.toLowerCase() === s);
      return hit ? { value: hit.value } : { missing: true };
    }
    case 'tags': {
      const items = list(raw, f.maxItems || 20, f.maxLen || 40);
      return items.length ? { value: items } : { missing: true, empty: true };
    }
    case 'video':
      return { value: clean(raw, 20) };
    default: {
      if (typeof raw !== 'string' && typeof raw !== 'number') return { missing: true };
      const s = f.type === 'textarea' ? String(raw).trim().slice(0, f.max) : clean(raw, f.max);
      if (!s) return { missing: true };
      if (s.length < (f.min || 1)) return { reason: `${f.label} needs more detail (at least ${f.min} characters).`, short: true };
      return { value: s };
    }
  }
}

/**
 * Turn what the model knows into draft arguments.
 * Returns { args, provenance, missing[], invalid[], autoMissing[] }.
 * Provenance per field: 'chat' | 'profile' | 'assumed' | 'auto'.
 */
function prepareArgs(def, raw, { stated = [], profile = {}, derivedKeys = [] } = {}) {
  const said = new Set(Array.isArray(stated) ? stated : []);
  const args = {};
  const provenance = {};
  const missing = [];
  const bad = [];
  const autoMissing = [];

  def.fields.forEach((f) => {
    if (f.type === 'video') return;
    const r = readField(f, raw[f.key]);
    const fromProfile = f.profile ? readField(f, f.profile.get(profile)) : { missing: true };
    // Saved values fill the draft; values only guessed from earlier work, and the subject of the
    // item (which role, which skill), are offered to the student as an option instead.
    const profileConfirmed = !fromProfile.missing && !derivedKeys.includes(f.profile.key) && !f.profile.hintOnly;

    if (said.has(f.key) && r.reason && !r.short) {
      bad.push({ key: f.key, question: f.ask, reason: r.reason });
      return;
    }
    let value;
    let source;
    if (said.has(f.key) && r.value !== undefined) [value, source] = [r.value, 'chat'];
    else if (said.has(f.key) && f.type === 'tags' && f.emptyOk && raw[f.key] !== undefined) [value, source] = [[], 'chat'];
    else if (profileConfirmed || (!fromProfile.missing && f.need === 'should')) [value, source] = [fromProfile.value, 'profile'];
    else if (r.value !== undefined) [value, source] = [r.value, f.need === 'auto' ? 'auto' : 'assumed'];
    else if (f.default !== undefined) [value, source] = [f.default, f.need === 'auto' ? 'auto' : 'assumed'];

    if (value !== undefined) {
      args[f.key] = value;
      provenance[f.key] = source;
    }
    if (f.need === 'must' && source !== 'chat' && source !== 'profile') {
      missing.push({
        key: f.key,
        question: r.short && said.has(f.key) ? `${f.ask} (${r.reason})` : f.ask,
        ...(f.options && f.type === 'select' ? { options: f.options.map((o) => o.label) } : {}),
        ...(f.examples ? { examples: f.examples } : {}),
        ...(!fromProfile.missing ? { hint: `Their earlier work suggests "${[].concat(fromProfile.value).join(', ')}" - offer it as the first option.` } : {}),
      });
    }
    if (f.need === 'auto' && value === undefined && f.type !== 'tags') autoMissing.push(f.key);
  });

  Object.entries(def.groups || {}).forEach(([name, g]) => {
    const members = def.fields.filter((f) => f.group === name);
    if (!members.some((f) => provenance[f.key] === 'chat' || provenance[f.key] === 'profile')) {
      missing.push({ key: name, question: g.ask, options: g.options });
    }
  });

  return { args, provenance, missing, invalid: bad, autoMissing };
}

/**
 * The student's edits on a draft, checked like the model's input was.
 * Only the draft's own fields can change; a video can only be one of the
 * candidates the server found. Throws a 400 the student can act on.
 */
function applyEdits(def, stored, edited) {
  const args = { ...(stored.args || {}) };
  const provenance = { ...(stored.provenance || {}) };
  if (!edited || typeof edited !== 'object' || Array.isArray(edited)) return { args, provenance };

  def.fields.forEach((f) => {
    if (!(f.key in edited)) return;
    const r = readField(f, edited[f.key]);
    if (r.reason) throw badRequest(r.reason);
    let value = r.value;
    if (r.missing) {
      if (f.type === 'tags' && (f.emptyOk || f.need !== 'must')) value = [];
      else if (f.need === 'must' || f.need === 'auto') throw badRequest(`${f.label} is required.`);
      else value = undefined;
    }
    if (f.type === 'video' && !(args.candidates || []).some((c) => c.videoId === value)) {
      throw badRequest('Pick one of the suggested videos.');
    }
    if (JSON.stringify(value) !== JSON.stringify(args[f.key])) {
      if (value === undefined) delete args[f.key];
      else args[f.key] = value;
      provenance[f.key] = 'edited';
    }
  });
  return { args, provenance };
}

/** Profile fields the student stated or confirmed on a draft (never assumed defaults). */
function profilePatchFrom(def, args, provenance = {}) {
  const patch = {};
  def.fields.forEach((f) => {
    if (!f.profile || args[f.key] === undefined) return;
    if (!['chat', 'edited', 'profile'].includes(provenance[f.key])) return;
    if (Array.isArray(args[f.key]) && !args[f.key].length) return;
    Object.assign(patch, f.profile.set(args[f.key]));
  });
  return cleanPatch(patch);
}

// ── the actions ────────────────────────────────────────────────────────────

const words = (s) => new Set(String(s).toLowerCase().match(/[a-z0-9+#.]{3,}/g) || []);
const overlap = (a, b) => {
  const [x, y] = [words(a), words(b)];
  if (!x.size || !y.size) return 0;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / Math.min(x.size, y.size);
};

const minutes = (duration) => {
  const parts = String(duration || '').split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((total, n) => total * 60 + n, 0) / 60;
};
const LENGTHS = { short: [0, 15], medium: [15, 45], long: [45, Infinity] };

const ACTIONS = {
  create_doubt: {
    tool: 'doubt',
    label: 'Create a doubt',
    section: 'Doubt Clearance',
    suggest: 'Offer to save the student\'s question as a doubt in Doubt Clearance, where they can keep chatting about it, get a summary with a diagram, video suggestions and a quiz.',
    prepareHint: 'It needs the SPECIFIC question (not just a broad topic like "Docker") and what confuses them or what they tried.',
    fields: [
      { key: 'question', label: 'Your question', type: 'textarea', need: 'must', min: 10, max: 1000, ask: 'What exactly do you want to understand? Name the specific concept or question.', describe: 'The specific question, in the first person, e.g. "What is the difference between Docker volumes and bind mounts?"' },
      { key: 'context', label: 'Where you are stuck', type: 'textarea', need: 'must', min: 5, max: 800, ask: 'What have you tried so far, or which part confuses you?', describe: 'In their words: what confuses them, what they tried, the error, or where it came up. If their question already shows exactly what confuses them, use that and list it as stated.' },
      { key: 'level', label: 'Your level', type: 'select', need: 'should', options: opts('beginner', 'intermediate', 'advanced'), profile: P.levelDoubt },
      { key: 'title', label: 'Title', type: 'text', need: 'auto', min: 3, max: 200, describe: 'Short, specific title, 3-8 words, e.g. "Docker Volumes vs Bind Mounts"' },
    ],
    summary: (a) => `"${a.title || a.question || ''}"`,
    async findExisting(a, userId) {
      const recent = await DoubtClearance.find({ userId }).sort({ createdAt: -1 }).limit(50).select('title createdAt').lean();
      const hit = recent.find((d) => overlap(d.title, a.title || a.question) >= 0.75);
      return hit && { label: `the doubt "${hit.title}"`, route: `/doubts?tool=doubts&open=${hit._id}`, progress: `created ${day(hit.createdAt)}` };
    },
    async run(a, ctx) {
      const description = a.description || [a.question, a.context, a.level ? `(My level: ${a.level})` : ''].filter(Boolean).join('\n\n').slice(0, 2000);
      const doubt = await createDoubt({ title: a.title, description, userId: ctx.userId }, { keepTitle: true }); // the agent's title is already specific
      // Carry the agent's explanation over, so the doubt opens with the context of this chat.
      if (ctx.sourceText) {
        const now = Date.now();
        await DoubtClearance.updateOne({ _id: doubt._id }, {
          $push: {
            chatHistory: {
              $each: [
                { role: 'user', content: description, timestamp: new Date(now) },
                { role: 'assistant', content: ctx.sourceText, timestamp: new Date(now + 1) },
              ],
            },
          },
        });
      }
      return { itemId: String(doubt._id), route: `/doubts?tool=doubts&open=${doubt._id}`, label: 'Open doubt' };
    },
  },

  add_video: {
    tool: 'video',
    label: 'Add a video',
    section: 'Video Summarizer',
    suggest: 'Offer to find and add a YouTube video on this topic to their Video Summarizer library, where they can chat with it, summarise it and take a quiz.',
    prepareHint: 'It needs the topic. The server searches YouTube and puts the 3 best matches on the draft for the student to pick; pass videoIds only if you already searched and want specific ones first.',
    fields: [
      { key: 'topic', label: 'Topic', type: 'text', need: 'must', min: 2, max: 120, ask: 'Which topic should the video cover?', describe: 'Specific topic to search, e.g. "Docker volumes explained"' },
      { key: 'level', label: 'Level', type: 'select', need: 'should', options: opts('beginner', 'intermediate', 'advanced'), profile: P.levelDoubt },
      { key: 'length', label: 'Length', type: 'select', need: 'should', default: 'any', options: opts(['short', 'Short (under 15 min)'], ['medium', '15-45 min'], ['long', 'Deep dive (45 min+)'], ['any', 'Any length']) },
      { key: 'videoId', label: 'Video', type: 'video', need: 'auto' },
    ],
    extraParams: { videoIds: { type: 'array', items: { type: 'string' }, description: 'Optional: ids from search_youtube_videos, best first' } },
    /** Find the candidates the student picks from on the draft. */
    async complete(args, raw, ctx) {
      const pool = new Map();
      (Array.isArray(raw.videoIds) ? raw.videoIds : []).forEach((id) => {
        const v = ctx.searchResults?.get(clean(id, 20));
        if (v) pool.set(v.videoId, v);
      });
      if (pool.size < 3) {
        const query = `${args.topic} ${args.level === 'beginner' ? 'for beginners' : args.level || ''} tutorial`.replace(/\s+/g, ' ').trim();
        ctx.emit?.('status', { text: `Searching YouTube for “${args.topic}”…` });
        const found = await searchVideos(query, 8).catch(() => []);
        found.forEach((v) => { ctx.searchResults?.set(v.videoId, v); if (!pool.has(v.videoId)) pool.set(v.videoId, v); });
      }
      let videos = [...pool.values()];
      const range = LENGTHS[args.length];
      if (range) {
        const fits = videos.filter((v) => { const m = minutes(v.duration); return m !== null && m >= range[0] && m < range[1]; });
        if (fits.length) videos = [...fits, ...videos.filter((v) => !fits.includes(v))];
      }
      const candidates = videos.slice(0, 3).map((v) => ({
        videoId: v.videoId,
        title: clean(v.title, 200),
        channelName: clean(v.channelName, 100),
        duration: clean(v.duration, 20),
        thumbnailUrl: v.thumbnailUrl || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      }));
      if (!candidates.length) throw invalid('No videos were found for that topic. Ask the student for a more specific topic.');
      args.candidates = candidates;
      args.videoId = candidates[0].videoId;
    },
    summary: (a) => {
      const v = (a.candidates || []).find((c) => c.videoId === a.videoId) || a;
      return v.title ? `"${v.title}"${v.channelName ? ` by ${v.channelName}` : ''}` : `on ${a.topic}`;
    },
    async run(a, ctx) {
      const v = (a.candidates || []).find((c) => c.videoId === a.videoId) || a;
      if (!v.videoId) throw invalid('Pick a video first.');
      const video = await addYouTubeVideo(
        { title: v.title, videoUrl: `https://www.youtube.com/watch?v=${v.videoId}`, userId: ctx.userId },
        { returnExisting: true },
      );
      return { itemId: String(video._id), route: `/video?tool=summarizer&open=${video._id}`, label: 'Open video' };
    },
  },

  generate_roadmap: {
    tool: 'roadmap',
    label: 'Generate a career roadmap',
    section: 'Smart Roadmap',
    suggest: 'Offer to generate a personalised, staged career roadmap (with a diagram) towards a target role in Smart Roadmap.',
    prepareHint: 'It needs the target role, their starting level, the related skills they already have, and how much time they can give.',
    fields: [
      { key: 'role', label: 'Target role', type: 'text', need: 'must', min: 2, max: 80, ask: 'Which role are you aiming for?', describe: 'e.g. "DevOps Engineer"', profile: P.role },
      { key: 'level', label: 'Starting level', type: 'select', need: 'must', ask: 'Where are you starting from?', options: opts(['beginner', 'Complete beginner'], ['intermediate', 'I know the basics'], ['experienced', 'Working professional, switching role']), profile: P.level3 },
      { key: 'knownSkills', label: 'Skills you have', type: 'tags', need: 'must', emptyOk: true, maxItems: 20, maxLen: 40, ask: 'Which related skills do you already have? ("none" is fine)', describe: 'Skills they already have. An empty list (listed as stated) means they said none.', profile: P.skills },
      { key: 'hoursPerWeek', label: 'Hours per week', type: 'int', need: 'should', min: 3, max: 40, default: 10, group: 'time', profile: P.hours },
      { key: 'timelineMonths', label: 'Timeline (months)', type: 'int', need: 'should', min: 1, max: 24, default: 6, group: 'time', profile: P.months },
      { key: 'goal', label: 'Goal', type: 'text', need: 'should', max: 240, describe: 'Their goal in their own words, e.g. "get a job at a product company"', profile: P.goal },
    ],
    groups: { time: { ask: 'How much time can you give - hours per week, or a target timeline?', options: ['5 h/week', '10 h/week', '20 h/week', 'Within 3 months', 'Within 6 months'] } },
    summary: (a) => [a.role, a.level, a.hoursPerWeek && `${a.hoursPerWeek} h/week`, a.timelineMonths && `${a.timelineMonths} months`, a.knownSkills?.length && `knows ${a.knownSkills.slice(0, 4).join(', ')}`].filter(Boolean).join(' · '),
    async findExisting(a, userId) {
      const hit = await Roadmap.findOne({ userId, role: sameText(a.role) }).sort({ createdAt: -1 }).select('role stages totalWeeks createdAt').lean();
      return hit && { label: `a ${hit.role} roadmap`, route: `/career?tool=roadmap&open=${hit._id}`, progress: `${(hit.stages || []).length} stages, created ${day(hit.createdAt)}` };
    },
    async run(a, ctx) {
      const roadmap = await createRoadmapFor(ctx.userId, a);
      return {
        itemId: String(roadmap._id),
        route: `/career?tool=roadmap&open=${roadmap._id}`,
        label: 'Open roadmap',
        note: `${(roadmap.stages || []).length} stages over about ${roadmap.totalWeeks || '?'} weeks`,
      };
    },
  },

  create_skill_plan: {
    tool: 'skill_plan',
    label: 'Create a learning plan',
    section: 'Skill Unlocker',
    suggest: 'Offer to create a day-by-day learning plan for ONE skill in Skill Unlocker: a topic, an objective and a YouTube video for each day, with progress tracking and quizzes.',
    prepareHint: 'It needs the skill, their current level in it, and what they want to be able to do by the end. Plans run 10-60 days.',
    fields: [
      { key: 'skillName', label: 'Skill', type: 'text', need: 'must', min: 2, max: 80, ask: 'Which skill do you want to learn?', describe: 'One skill, e.g. "React Hooks" or "SQL"' },
      { key: 'level', label: 'Current level', type: 'select', need: 'must', ask: 'What is your current level in it?', options: opts(['beginner', 'Beginner - new to it'], ['intermediate', 'Intermediate - I know the basics']), profile: P.level2 },
      { key: 'description', label: 'By the end you can', type: 'textarea', need: 'must', min: 10, max: 500, ask: 'What do you want to be able to do by the end (e.g. build a REST API, pass an interview, use it at work)?', describe: 'The outcome they want, in their words' },
      { key: 'durationDays', label: 'Days', type: 'int', need: 'should', min: 10, max: 60, default: 14, ask: 'How many days should the plan be (10-60)?' },
      { key: 'focusAreas', label: 'Focus on', type: 'tags', need: 'should', maxItems: 8, maxLen: 60, describe: 'Sub-topics to emphasise' },
      { key: 'language', label: 'Language', type: 'select', need: 'should', default: 'English', options: opts(...LANGUAGES), profile: P.language },
      { key: 'teachingStyle', label: 'Teaching style', type: 'select', need: 'should', default: 'Standard', options: opts(...STYLES), profile: P.style },
    ],
    summary: (a) => [a.skillName, a.durationDays && `${a.durationDays} days`, a.level, a.language && a.language !== 'English' && a.language].filter(Boolean).join(' · '),
    async findExisting(a, userId) {
      const hit = await SkillPlan.findOne({ userId, skillName: sameText(a.skillName) }).sort({ createdAt: -1 }).select('skillName dailyPlan.completed').lean();
      if (!hit) return null;
      const days = hit.dailyPlan || [];
      return { label: `a ${hit.skillName} plan`, route: `/skill-unlocker?open=${hit._id}`, progress: `${days.filter((d) => d.completed).length} of ${days.length} days done` };
    },
    async run(a, ctx) {
      const plan = await createSkillPlan({
        userId: ctx.userId,
        skillName: a.skillName,
        duration: a.durationDays || 14,
        description: a.description || `Learn ${a.skillName} from the basics to practical use.`,
        preferences: { level: a.level, focusAreas: a.focusAreas || [], language: a.language || 'English', teachingStyle: a.teachingStyle || 'Standard' },
      });
      return { itemId: String(plan._id), route: `/skill-unlocker?open=${plan._id}`, label: 'Open plan', note: `${plan.dailyPlan.length} days` };
    },
  },

  skill_gap_analysis: {
    tool: 'skill_gap_analysis',
    label: 'Run a skill gap analysis',
    section: 'Skill Gap Analysis',
    suggest: 'Offer to analyse the student\'s skills against a target role in Skill Gap Analysis: readiness %, the skills they have, the gaps ranked by priority, then a coaching chat.',
    prepareHint: 'It needs the target role, the skills they have now, and their experience.',
    fields: [
      { key: 'targetRole', label: 'Target role', type: 'text', need: 'must', min: 2, max: 80, ask: 'Which role do you want to be ready for?', profile: P.role },
      { key: 'currentSkills', label: 'Your skills', type: 'tags', need: 'must', emptyOk: true, maxItems: 30, maxLen: 40, ask: 'Which skills do you have right now (languages, tools, frameworks)?', describe: 'Skills they have now. An empty list (listed as stated) means they said none.', profile: P.skills },
      { key: 'experience', label: 'Experience', type: 'select', need: 'must', ask: 'Which describes you best?', options: opts(['student', 'Student'], ['junior', 'Junior (0-2 years)'], ['switching', 'Switching careers'], ['experienced', 'Experienced professional']), profile: P.experience },
      { key: 'hoursPerWeek', label: 'Hours per week', type: 'int', need: 'should', min: 2, max: 40, default: 10, profile: P.hours },
      { key: 'goal', label: 'Goal', type: 'text', need: 'should', max: 240, profile: P.goal },
    ],
    summary: (a) => `${a.targetRole}${a.currentSkills?.length ? ` · knows ${a.currentSkills.slice(0, 4).join(', ')}${a.currentSkills.length > 4 ? '…' : ''}` : ''}`,
    async findExisting(a, userId) {
      const hit = await SkillGapSession.findOne({ userId, 'profile.targetRole': sameText(a.targetRole) }).sort({ updatedAt: -1 }).select('profile.targetRole analysis.readiness updatedAt').lean();
      return hit && { label: `a skill gap analysis for ${hit.profile.targetRole}`, route: `/career?tool=skills&open=${hit._id}`, progress: `${hit.analysis?.readiness ?? '?'}% ready, updated ${day(hit.updatedAt)}` };
    },
    async run(a, ctx) {
      const session = await startSession(ctx.userId, a);
      return {
        itemId: String(session._id),
        route: `/career?tool=skills&open=${session._id}`,
        label: 'Open analysis',
        note: `${session.analysis.readiness}% ready · ${session.analysis.gaps.length} skills to learn`,
      };
    },
  },

  forum_post: {
    tool: 'forum_post',
    label: 'Post to the AI Forum',
    section: 'AI Forum',
    suggest: 'Offer to start a discussion in the AI Forum, for questions that benefit from other students\' experience or opinions (not for plain concept questions).',
    prepareHint: 'It needs the actual question for the community with context (what they tried, their situation). It is public, so the student always reviews it first.',
    fields: [
      { key: 'title', label: 'Title', type: 'text', need: 'auto', min: 3, max: 200 },
      { key: 'description', label: 'Your post', type: 'textarea', need: 'must', min: 40, max: 5000, ask: 'What exactly do you want to ask the community, and what have you tried so far?', describe: 'The full question with their context, written as the student' },
      { key: 'category', label: 'Category', type: 'select', need: 'auto', default: 'general', options: opts(...CATEGORIES) },
      { key: 'tags', label: 'Tags', type: 'tags', need: 'auto', maxItems: 8, maxLen: 30 },
    ],
    summary: (a) => `"${a.title}"${a.category ? ` in ${a.category}` : ''}`,
    async run(a, ctx) {
      const issue = await openIssue({ title: a.title, description: a.description, category: a.category || 'general', tags: a.tags || [], userEmail: ctx.userId, userName: ctx.userName || 'Student' });
      return { itemId: issue.issueId, route: `/forum?open=${issue.issueId}`, label: 'Open discussion' };
    },
  },
};

/** "Remember this about me?" - saves to the learner profile once the student says Yes. */
const PROFILE_UPDATE = {
  label: 'Remember about you',
  section: 'Learner profile',
  normalize: (raw) => {
    const patch = cleanPatch(raw);
    Object.keys(patch).forEach((k) => { if (patch[k] === null || (Array.isArray(patch[k]) && !patch[k].length)) delete patch[k]; });
    if (!Object.keys(patch).length) throw invalid('Nothing to remember - pass at least one profile field.');
    return patch;
  },
  summary: (a) => Object.entries(a).map(([k, v]) => `${PROFILE_FIELDS[k]?.label || k}: ${[].concat(v).join(', ')}`).join(' · '),
  async run(a, ctx) {
    await updateProfile(ctx.userId, a, { strict: false, mergeLists: true });
    return { label: 'Saved', note: 'Saved to your learner profile' };
  },
};

// ── tools the model sees ───────────────────────────────────────────────────

const fn = (name, description, properties, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});

const paramFor = (f) => {
  const description = [f.describe, f.type === 'int' ? `${f.min}-${f.max}` : ''].filter(Boolean).join(' ') || undefined;
  if (f.type === 'int') return { type: 'integer', description };
  if (f.type === 'select') return { type: 'string', enum: f.options.map((o) => o.value), ...(description ? { description } : {}) };
  if (f.type === 'tags') return { type: 'array', items: { type: 'string' }, ...(description ? { description } : {}) };
  return { type: 'string', ...(description ? { description } : {}) };
};

Object.entries(ACTIONS).forEach(([type, a]) => {
  a.type = type;
  const askable = a.fields.filter((f) => f.need !== 'auto' && f.type !== 'video').map((f) => f.key);
  a.suggestTool = fn(
    `suggest_${a.tool}`,
    `${a.suggest} Use after answering a learning question. It only shows a small offer card; if they say Yes, you then gather the details and call prepare_${a.tool}.`,
    {
      topic: { type: 'string', description: 'What it would be about, e.g. "Docker volumes vs bind mounts" or "DevOps Engineer"' },
      reason: { type: 'string', description: 'One short sentence on why it would help them' },
    },
    ['topic'],
  );
  a.prepareTool = fn(
    `prepare_${a.tool}`,
    `Prepare a DRAFT to ${lowerFirst(a.label)} in ${a.section}, when the student wants it (they asked, or said yes to your suggestion). ${a.prepareHint} Call it with everything you know - the server fills gaps from their profile and tells you exactly what is still missing, so you can ask. Nothing is created here: the student reviews the draft and presses Create.`,
    {
      ...Object.fromEntries(a.fields.filter((f) => f.type !== 'video').map((f) => [f.key, paramFor(f)])),
      ...(a.extraParams || {}),
      stated: { type: 'array', items: { type: 'string', enum: askable }, description: 'The fields the student actually told you in this conversation (any message) or clearly implied, e.g. the topic of the question they asked. NEVER list a field you guessed.' },
      ...(a.findExisting ? { allowDuplicate: { type: 'boolean', description: 'true only when the student said they want a new one although they already have one' } } : {}),
    },
  );
});

PROFILE_UPDATE.tool = fn(
  'remember_about_student',
  'Offer to remember a lasting fact the student told you about themselves (level, experience, target role, skills, weekly hours, goal, preferred language or teaching style) in their learner profile, so future chats and drafts use it. Shows a "Remember this?" card; it is saved only if they say Yes. Only for facts they stated, not guesses, and not for what a draft they are creating already saves.',
  Object.fromEntries(Object.entries(PROFILE_FIELDS).map(([k, f]) => [k, f.kind === 'list'
    ? { type: 'array', items: { type: 'string' } }
    : f.kind === 'int' ? { type: 'integer' } : f.kind === 'enum' ? { type: 'string', enum: f.options } : { type: 'string' }])),
);

/** The sentence added after an answer when a suggestion is attached without one. */
const SUGGEST_LINES = {
  create_doubt: 'Want to go deeper on this? I can save it as a doubt in Doubt Clearance so you can keep asking, get a diagram and quiz yourself - just confirm below.',
  add_video: 'I can find a good video on this and add it to your library - just confirm below.',
  generate_roadmap: 'I can turn this into a personalised roadmap for you in Smart Roadmap - just confirm below.',
  create_skill_plan: 'Want a day-by-day plan for this? I can build one in Skill Unlocker - just confirm below.',
  skill_gap_analysis: 'I can check exactly which skills you are missing for this role - just confirm below.',
  forum_post: 'Other students may have been through this - I can post it to the AI Forum for you, just confirm below.',
};
Object.entries(SUGGEST_LINES).forEach(([type, line]) => { ACTIONS[type].suggestLine = line; });

/** Tool name -> { type, mode }: 'suggest' offers a next step, 'prepare' drafts it. */
const TOOL_TO_ACTION = Object.fromEntries(Object.entries(ACTIONS).flatMap(([type, a]) => [
  [a.suggestTool.function.name, { type, mode: 'suggest' }],
  [a.prepareTool.function.name, { type, mode: 'prepare' }],
]));

const defFor = (type) => (type === 'profile_update' ? PROFILE_UPDATE : ACTIONS[type]);

/** One line describing a card's content, for the card and the model's memory. */
function summarize(type, args = {}) {
  const def = defFor(type);
  if (!def) return type;
  if (args.topic && !args.videoId) return `about "${args.topic}"`;
  try { return def.summary(args); } catch { return ''; }
}

/**
 * What the client needs to render a card, computed on the way out rather than
 * stored: the form fields of a draft, a one-line summary, and for a suggestion
 * the message sent when the student says Yes.
 */
function withMeta(action) {
  const def = defFor(action.type);
  if (!def) return action;
  const summary = summarize(action.type, action.args);
  const fields = (def.fields || []).map(({ key, label, type, need, options, min, max, maxItems }) => ({
    key, label, type, need, ...(options ? { options } : {}), ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), ...(maxItems ? { maxItems } : {}),
  }));
  return {
    ...action,
    meta: {
      label: def.label,
      section: def.section,
      summary,
      fields,
      rememberable: (def.fields || []).some((f) => f.profile && Object.keys(f.profile.set('x')).length),
      followUp: `Yes, let's ${lowerFirst(def.label)} ${summary.startsWith('about') ? summary : `for ${summary}`}.`,
    },
  };
}

module.exports = {
  ACTIONS,
  PROFILE_UPDATE,
  TOOL_TO_ACTION,
  defFor,
  summarize,
  withMeta,
  prepareArgs,
  applyEdits,
  profilePatchFrom,
  readField,
  _internal: { overlap, minutes, list },
};
