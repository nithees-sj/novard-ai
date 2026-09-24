const Groq = require('groq-sdk');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');
const { parseModelJson } = require('../utils/parseModelJson');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Skill-gap coach.
 *
 * 1. analyse(): one structured call lists the skills the target role needs,
 *    whether the student has each, and - for the missing ones - priority,
 *    effort and a first step. Readiness is then *computed* from that list
 *    (core skills count double), not made up by the model.
 * 2. reply(): an ordinary conversation, grounded in the student's profile and
 *    that analysis, so every answer is about their specific gaps.
 */

const EXPERIENCE = {
  student: 'a student or complete beginner with no professional experience',
  junior: 'an early-career person (0-2 years) in or near tech',
  switching: 'an experienced professional switching from another field',
  experienced: 'an experienced engineer moving to a new specialism',
};

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const escapeRegex = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function readProfile(body = {}) {
  const skills = (Array.isArray(body.currentSkills) ? body.currentSkills : String(body.currentSkills || '').split(','))
    .map((s) => clean(s, 40))
    .filter(Boolean);
  const seen = new Set();
  const hours = parseInt(body.hoursPerWeek, 10);
  return {
    targetRole: clean(body.targetRole, 80),
    currentSkills: skills.filter((s) => (seen.has(s.toLowerCase()) ? false : seen.add(s.toLowerCase()))).slice(0, 30),
    experience: EXPERIENCE[body.experience] ? body.experience : 'student',
    goal: clean(body.goal, 240),
    hoursPerWeek: Number.isFinite(hours) ? Math.min(40, Math.max(2, hours)) : 10,
  };
}

const describeProfile = (p) => [
  `Target role: ${p.targetRole}`,
  `Background: ${EXPERIENCE[p.experience]}`,
  `Current skills: ${p.currentSkills.length ? p.currentSkills.join(', ') : 'none listed'}`,
  `Time available: about ${p.hoursPerWeek} hours per week`,
  p.goal ? `Goal: ${p.goal}` : null,
].filter(Boolean).join('\n');

// ── analysis ───────────────────────────────────────────────────────────────

function analysisPrompt(profile) {
  return [
    'Do a skill-gap analysis for this learner.',
    '',
    describeProfile(profile),
    '',
    'List the 10-16 skills that a hiring manager expects for this role today. Use specific, current,',
    'industry-standard names (real tools and practices, not vague categories). For each skill say whether',
    'the learner already has it, judged ONLY from their listed skills (a listed skill that clearly covers it counts).',
    '',
    'Return ONLY this JSON:',
    '{',
    '  "summary": "2-3 honest, encouraging sentences on where they stand and the biggest gap",',
    '  "skills": [',
    '    {',
    '      "skill": "Short name",',
    '      "importance": "core" | "nice",',
    '      "have": true | false,',
    '      "why": "One sentence: why this matters for the role",',
    '      "priority": "high" | "medium" | "low",   // only meaningful when have is false',
    '      "effortWeeks": 3,                        // realistic at their hours per week; 0 when have is true',
    '      "firstStep": "One concrete first action"  // only when have is false',
    '    }',
    '  ],',
    '  "nextSteps": ["3 short, concrete actions for the next two weeks"]',
    '}',
  ].join('\n');
}

function normaliseAnalysis(raw, profile) {
  const listed = profile.currentSkills.map((s) => new RegExp(`(^|[^a-z0-9+#])${escapeRegex(s.toLowerCase())}($|[^a-z0-9+#])`, 'i'));
  const userHas = (name) => listed.some((re) => re.test(name.toLowerCase()));

  const seen = new Set();
  const skills = (Array.isArray(raw?.skills) ? raw.skills : [])
    .map((s) => {
      const skill = clean(s?.skill, 50);
      if (!skill || seen.has(skill.toLowerCase())) return null;
      seen.add(skill.toLowerCase());
      const have = Boolean(s?.have) || userHas(skill);
      return {
        skill,
        importance: s?.importance === 'nice' ? 'nice' : 'core',
        have,
        why: clean(s?.why, 240),
        priority: have ? null : (['high', 'medium', 'low'].includes(s?.priority) ? s.priority : 'medium'),
        effortWeeks: have ? 0 : Math.min(26, Math.max(1, Math.round(Number(s?.effortWeeks) || 2))),
        firstStep: have ? '' : clean(s?.firstStep, 240),
      };
    })
    .filter(Boolean)
    .slice(0, 18);

  if (skills.length < 5) return null;

  // Readiness is calculated, not asked for: core skills weigh twice as much as nice-to-haves.
  const weight = (s) => (s.importance === 'core' ? 2 : 1);
  const total = skills.reduce((n, s) => n + weight(s), 0);
  const have = skills.filter((s) => s.have).reduce((n, s) => n + weight(s), 0);
  const order = { high: 0, medium: 1, low: 2 };

  return {
    summary: clean(raw?.summary, 600),
    readiness: Math.round((have / total) * 100),
    strengths: skills.filter((s) => s.have),
    gaps: skills.filter((s) => !s.have)
      .sort((a, b) => order[a.priority] - order[b.priority] || (a.importance === 'core' ? -1 : 1)),
    nextSteps: (Array.isArray(raw?.nextSteps) ? raw.nextSteps : []).map((t) => clean(t, 200)).filter(Boolean).slice(0, 4),
  };
}

async function analyse(profile) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are an experienced tech hiring manager and career coach. You are specific, current and honest. You always return valid JSON.' },
          { role: 'user', content: analysisPrompt(profile) },
        ],
        model: MODELS.REASONING,
        ...GROQ_DEFAULTS,
        temperature: 0.4,
        max_tokens: 5000,
      });
      const analysis = normaliseAnalysis(parseModelJson(completion.choices[0]?.message?.content || '', { context: 'skill analysis' }), profile);
      if (analysis) return analysis;
      lastError = new Error('Analysis came back incomplete');
    } catch (error) {
      lastError = error;
    }
  }
  const error = new Error('The analysis could not be generated. Please try again.');
  error.status = 502;
  error.cause = lastError;
  throw error;
}

/** The coach's opening message, written from the analysis (no extra model call). */
function openingMessage(profile, analysis) {
  const top = analysis.gaps.slice(0, 3);
  const lines = [
    `### Your skill gap for **${profile.targetRole}**`,
    '',
    analysis.summary,
    '',
    `**Estimated readiness: ${analysis.readiness}%** - you already cover ${analysis.strengths.length} of the ${analysis.strengths.length + analysis.gaps.length} skills I'd expect for this role.`,
  ];
  if (top.length) {
    lines.push('', '### Where I would start');
    top.forEach((g, i) => {
      lines.push(`${i + 1}. **${g.skill}** (${g.priority} priority, about ${g.effortWeeks} ${g.effortWeeks === 1 ? 'week' : 'weeks'}) - ${g.why}`);
      if (g.firstStep) lines.push(`   - First step: ${g.firstStep}`);
    });
  }
  lines.push('', 'Ask me anything - what to learn first, how to learn a specific skill, a week-by-week plan, or which projects would prove these skills. If you pick up something new, just tell me and I will adjust.');
  return lines.join('\n');
}

// ── conversation ───────────────────────────────────────────────────────────

function coachSystemPrompt(profile, analysis) {
  const have = analysis.strengths.map((s) => s.skill).join(', ') || 'none yet';
  const gaps = analysis.gaps.map((g) => `${g.skill} (${g.priority}, ~${g.effortWeeks}w)`).join(', ') || 'none';
  return [
    'You are a friendly, experienced career coach helping one learner close their skill gap. Talk naturally,',
    'like a mentor in a chat - not like a document.',
    '',
    'The learner:',
    describeProfile(profile),
    '',
    `Skills they have that matter: ${have}`,
    `Their gaps, most important first: ${gaps}`,
    `Estimated readiness: ${analysis.readiness}%`,
    '',
    'How to answer:',
    '- Always tie advice to THIS learner: their gaps, their background and their hours per week.',
    '- Be specific: name real tools, concrete exercises, project ideas and how long things take.',
    '- This is a chat. By default reply in a few sentences or a short list - under about 120 words - with no',
    '  headings and no tables, and end with one short follow-up question or suggestion when it helps.',
    '- Only go long when they explicitly ask for a plan, schedule, comparison or detailed breakdown. Then use',
    '  GitHub-flavoured Markdown (### headings, lists, a table when comparing).',
    '- Never emit raw HTML.',
    '- If they say they have learned something new, acknowledge it and re-prioritise their remaining gaps.',
    '- If they ask about something unrelated to their learning or career, answer briefly and steer back.',
    '- Be honest about difficulty and timelines, and encouraging.',
  ].join('\n');
}


module.exports = {
  EXPERIENCE,
  readProfile,
  analyse,
  openingMessage,
  coachSystemPrompt,
  _internal: { normaliseAnalysis, coachSystemPrompt },
};
