const LearnerProfile = require('../models/learnerProfile');
const Roadmap = require('../models/roadmap');
const SkillGapSession = require('../models/skillGapSession');
const SkillPlan = require('../models/skillPlan');
const { badRequest } = require('../utils/httpError');

/**
 * The learner profile: what the Novard Agent remembers about a student
 * between chats, so it can fill in drafts and ask fewer questions.
 *
 * The saved profile only changes when the student confirms. Until then, gaps
 * are filled from their latest roadmap, skill-gap analysis and learning plan
 * ("derived" values), which the agent treats as a hint, not as a fact.
 */

const FIELDS = {
  level: { label: 'Level', kind: 'enum', options: ['beginner', 'intermediate', 'experienced'] },
  experience: { label: 'Experience', kind: 'enum', options: ['student', 'junior', 'switching', 'experienced'] },
  targetRole: { label: 'Target role', kind: 'text', max: 80 },
  knownSkills: { label: 'Known skills', kind: 'list', maxItems: 40, maxLen: 40 },
  interests: { label: 'Interests', kind: 'list', maxItems: 20, maxLen: 40 },
  hoursPerWeek: { label: 'Hours per week', kind: 'int', min: 1, max: 60 },
  timelineMonths: { label: 'Timeline (months)', kind: 'int', min: 1, max: 24 },
  goal: { label: 'Goal', kind: 'text', max: 240 },
  language: { label: 'Preferred language', kind: 'text', max: 40 },
  teachingStyle: { label: 'Teaching style', kind: 'text', max: 60 },
  notes: { label: 'Notes', kind: 'text', max: 500 },
};
const KEYS = Object.keys(FIELDS);

const cleanText = (v) => String(v).replace(/\s+/g, ' ').trim();

/** Case-insensitive de-duplication, keeping the first spelling. */
function uniqueList(items, maxItems, maxLen) {
  const seen = new Set();
  const out = [];
  items.forEach((raw) => {
    const item = cleanText(raw).slice(0, maxLen);
    const key = item.toLowerCase();
    if (item && !seen.has(key)) { seen.add(key); out.push(item); }
  });
  return out.slice(0, maxItems);
}

/**
 * One field's value, cleaned; `null` clears it. Invalid values throw when
 * `strict` (the student's own edits) and are dropped otherwise (agent input).
 */
function cleanField(key, value, strict) {
  const f = FIELDS[key];
  if (value === null || value === '' || (Array.isArray(value) && !value.length && f.kind !== 'list')) return null;
  const fail = (message) => {
    if (strict) throw badRequest(message);
    return undefined;
  };
  switch (f.kind) {
    case 'enum':
      return f.options.includes(value) ? value : fail(`${f.label} must be one of: ${f.options.join(', ')}.`);
    case 'int': {
      const n = typeof value === 'number' ? value : Number(String(value).trim());
      if (!Number.isInteger(n) || n < f.min || n > f.max) return fail(`${f.label} must be a whole number from ${f.min} to ${f.max}.`);
      return n;
    }
    case 'list': {
      const items = Array.isArray(value) ? value : String(value).split(',');
      if (items.some((x) => typeof x !== 'string' && typeof x !== 'number')) return fail(`${f.label} must be a list of words.`);
      return uniqueList(items, f.maxItems, f.maxLen);
    }
    default: {
      if (typeof value !== 'string' && typeof value !== 'number') return fail(`${f.label} must be text.`);
      const out = cleanText(value);
      if (out.length > f.max) return strict ? fail(`${f.label} must be ${f.max} characters or fewer.`) : out.slice(0, f.max);
      return out || null;
    }
  }
}

/** Only known fields, cleaned. */
function cleanPatch(patch, { strict = false } = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    if (strict) throw badRequest('Send the profile fields to update.');
    return {};
  }
  const out = {};
  KEYS.forEach((key) => {
    if (!(key in patch)) return;
    const value = cleanField(key, patch[key], strict);
    if (value !== undefined) out[key] = value;
  });
  return out;
}

const pick = (doc) => Object.fromEntries(KEYS
  .filter((k) => doc?.[k] !== undefined && doc[k] !== null && !(Array.isArray(doc[k]) && !doc[k].length))
  .map((k) => [k, doc[k]]));

/** A best guess from the student's latest roadmap, skill-gap analysis and plan. Never saved on its own. */
async function deriveProfile(userId) {
  const [roadmap, gap, plan] = await Promise.all([
    Roadmap.findOne({ userId }).sort({ createdAt: -1 }).select('role inputs createdAt').lean(),
    SkillGapSession.findOne({ userId }).sort({ updatedAt: -1 }).select('profile updatedAt').lean(),
    SkillPlan.findOne({ userId }).sort({ createdAt: -1 }).select('preferences').lean(),
  ]);
  const out = {};
  // The newer of the roadmap and the analysis wins for the shared fields.
  const sources = [
    roadmap && { at: roadmap.createdAt, targetRole: roadmap.role, level: roadmap.inputs?.level, hoursPerWeek: roadmap.inputs?.hoursPerWeek, timelineMonths: roadmap.inputs?.timelineMonths, goal: roadmap.inputs?.goal, skills: roadmap.inputs?.knownSkills },
    gap && { at: gap.updatedAt, targetRole: gap.profile?.targetRole, experience: gap.profile?.experience, hoursPerWeek: gap.profile?.hoursPerWeek, goal: gap.profile?.goal, skills: gap.profile?.currentSkills },
  ].filter(Boolean).sort((a, b) => new Date(a.at) - new Date(b.at));
  sources.forEach((s) => {
    ['targetRole', 'level', 'experience', 'hoursPerWeek', 'timelineMonths', 'goal'].forEach((k) => {
      if (s[k] !== undefined && s[k] !== null && s[k] !== '') out[k] = s[k];
    });
  });
  const skills = sources.flatMap((s) => s.skills || []);
  if (skills.length) out.knownSkills = skills;
  if (plan?.preferences?.language) out.language = plan.preferences.language;
  if (plan?.preferences?.teachingStyle) out.teachingStyle = plan.preferences.teachingStyle;
  return cleanPatch(out);
}

/**
 * The profile the agent works with: saved values, with gaps filled from
 * derived ones. `derivedKeys` lists the fields the student has not confirmed.
 */
async function getProfile(userId) {
  const [saved, derived] = await Promise.all([
    LearnerProfile.findOne({ userId }).lean(),
    deriveProfile(userId).catch(() => ({})),
  ]);
  const stored = pick(saved);
  const derivedKeys = Object.keys(derived).filter((k) => !(k in stored));
  const profile = { ...Object.fromEntries(derivedKeys.map((k) => [k, derived[k]])), ...stored };
  return { profile, derivedKeys, saved: Boolean(saved), updatedAt: saved?.updatedAt || null };
}

/**
 * Save fields the student confirmed. `null` clears a field. With `mergeLists`,
 * skills and interests are added to the saved ones instead of replacing them.
 */
async function updateProfile(userId, patch, { strict = true, mergeLists = false } = {}) {
  const clean = cleanPatch(patch, { strict });
  if (!Object.keys(clean).length) return getProfile(userId);

  if (mergeLists) {
    const existing = await LearnerProfile.findOne({ userId }).select('knownSkills interests').lean();
    ['knownSkills', 'interests'].forEach((k) => {
      if (clean[k]) clean[k] = uniqueList([...(existing?.[k] || []), ...clean[k]], FIELDS[k].maxItems, FIELDS[k].maxLen);
    });
  }

  const $set = {};
  const $unset = {};
  Object.entries(clean).forEach(([k, v]) => {
    if (v === null || (Array.isArray(v) && !v.length)) $unset[k] = '';
    else $set[k] = v;
  });
  await LearnerProfile.updateOne(
    { userId },
    { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}), $setOnInsert: { userId } },
    { upsert: true },
  );
  return getProfile(userId);
}

/** The profile as lines for the agent's instructions. */
function profileForPrompt({ profile, derivedKeys = [] }) {
  const lines = KEYS.filter((k) => profile[k] !== undefined).map((k) => {
    const v = Array.isArray(profile[k]) ? profile[k].join(', ') : profile[k];
    return `- ${FIELDS[k].label}: ${v}${derivedKeys.includes(k) ? ' (guessed from their earlier work, not confirmed)' : ''}`;
  });
  return lines.length ? lines.join('\n') : '- Nothing yet.';
}

module.exports = { FIELDS, getProfile, updateProfile, deriveProfile, cleanPatch, profileForPrompt };
