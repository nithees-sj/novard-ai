const Groq = require('groq-sdk');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');
const { parseModelJson } = require('../utils/parseModelJson');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Personalised career roadmaps.
 *
 * The model is asked for a *structured* roadmap (stages -> topics -> project),
 * never for Mermaid. The diagram is then built from that structure in code
 * (buildRoadmapMermaid), so it is always valid Mermaid and always has the same
 * professional layout and styling, however the model phrases things.
 */

const LEVELS = {
  beginner: 'a complete beginner with no programming or industry experience',
  intermediate: 'someone who knows the basics and has built small things, but is not job-ready',
  experienced: 'a working professional switching into this role, comfortable with general software concepts',
};

const LIMITS = { stagesMin: 4, stagesMax: 7, topicsMin: 3, topicsMax: 6 };

// ── input ──────────────────────────────────────────────────────────────────

function readRoadmapInput(body = {}) {
  const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const role = clean(body.role, 80);
  const hours = parseInt(body.hoursPerWeek, 10);
  const months = parseInt(body.timelineMonths, 10);
  const known = (Array.isArray(body.knownSkills) ? body.knownSkills : String(body.knownSkills || '').split(','))
    .map((s) => clean(s, 40))
    .filter(Boolean);

  return {
    role,
    level: LEVELS[body.level] ? body.level : 'beginner',
    hoursPerWeek: Number.isFinite(hours) ? Math.min(40, Math.max(3, hours)) : 10,
    timelineMonths: Number.isFinite(months) ? Math.min(24, Math.max(1, months)) : 6,
    knownSkills: [...new Set(known.map((s) => s.toLowerCase()))].slice(0, 20)
      .map((lower) => known.find((s) => s.toLowerCase() === lower)),
    goal: clean(body.goal, 200),
  };
}

// ── generation ─────────────────────────────────────────────────────────────

function buildPrompt(input) {
  const weeks = Math.round(input.timelineMonths * 4.33);
  return [
    `Design a learning roadmap to become a ${input.role}.`,
    '',
    'About the learner:',
    `- Starting point: ${LEVELS[input.level]}.`,
    `- Time available: about ${input.hoursPerWeek} hours per week for roughly ${input.timelineMonths} months (${weeks} weeks in total).`,
    input.knownSkills.length
      ? `- Already knows: ${input.knownSkills.join(', ')}. Do not re-teach these from scratch; include them only where they are a prerequisite, and mark them "known": true.`
      : '- Already knows: nothing specific.',
    input.goal ? `- Their goal: ${input.goal}` : '',
    '',
    'Requirements:',
    `- ${LIMITS.stagesMin} to ${LIMITS.stagesMax} stages, in the order they should be learned. Each builds on the previous one.`,
    `- ${LIMITS.topicsMin} to ${LIMITS.topicsMax} topics per stage. Topic names are short (2-5 words), specific and industry-standard (name real tools, e.g. "React Router", not "a routing library").`,
    '- Mark each topic "core" (needed to be hireable) or "optional" (valuable but can be skipped).',
    '- Stage "weeks" must be realistic for the hours available and add up to the total timeline.',
    '- Every stage ends with one portfolio project that uses that stage\'s topics.',
    '- "searchQuery" is a good YouTube search to learn that topic. Do not invent URLs.',
    '- Be current: use tools and practices that are standard in industry today. Never recommend deprecated or legacy tools '
      + '(for example Create React App - use Vite or a framework instead; not Bower, Grunt, jQuery-first or AngularJS).',
    '',
    'Return ONLY this JSON, no other text:',
    '{',
    '  "summary": "2-3 sentences: what this path covers and why it is ordered this way",',
    '  "stages": [',
    '    {',
    '      "title": "Stage name (2-4 words)",',
    '      "weeks": 4,',
    '      "objective": "One sentence: what the learner can do after this stage",',
    '      "topics": [',
    '        { "name": "...", "type": "core", "known": false, "description": "One sentence: what it is", "why": "One sentence: why it matters for this role", "searchQuery": "..." }',
    '      ],',
    '      "project": { "title": "...", "description": "Two sentences", "skills": ["...", "..."] },',
    '      "milestone": "One sentence checkpoint to confirm the stage is done"',
    '    }',
    '  ],',
    '  "careerTips": ["3-5 short, specific tips for landing the role: portfolio, interviews, communities"]',
    '}',
  ].filter((l) => l !== '').join('\n');
}

const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Validate and tidy the model's roadmap; drop anything unusable. */
function normaliseRoadmap(raw, input) {
  // Whole-word match, so knowing "C" does not mark "CSS" or "CI/CD" as known.
  const escape = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const knownPatterns = input.knownSkills.map((k) => new RegExp(`(^|[^a-z0-9+#])${escape(k.toLowerCase())}($|[^a-z0-9+#])`, 'i'));
  const isKnown = (name) => knownPatterns.some((re) => re.test(name.toLowerCase()));

  const stages = (Array.isArray(raw?.stages) ? raw.stages : [])
    .map((s) => {
      const topics = (Array.isArray(s?.topics) ? s.topics : [])
        .map((t) => {
          const name = text(t?.name, 60);
          if (!name) return null;
          return {
            name,
            type: t?.type === 'optional' ? 'optional' : 'core',
            known: Boolean(t?.known) || isKnown(name),
            description: text(t?.description, 300),
            why: text(t?.why, 300),
            searchQuery: text(t?.searchQuery, 120) || `${name} tutorial`,
          };
        })
        .filter(Boolean)
        .slice(0, LIMITS.topicsMax);
      const title = text(s?.title, 50);
      if (!title || topics.length < 2) return null;
      return {
        title,
        weeks: Math.max(1, Math.round(Number(s?.weeks) || 2)),
        objective: text(s?.objective, 300),
        topics,
        project: s?.project?.title ? {
          title: text(s.project.title, 70),
          description: text(s.project.description, 400),
          skills: (Array.isArray(s.project.skills) ? s.project.skills : []).map((k) => text(k, 40)).filter(Boolean).slice(0, 6),
        } : null,
        milestone: text(s?.milestone, 250),
      };
    })
    .filter(Boolean)
    .slice(0, LIMITS.stagesMax);

  if (stages.length < 3) return null;

  // Fit the stage lengths to the timeline the learner asked for, then number the weeks.
  const targetWeeks = Math.max(stages.length, Math.round(input.timelineMonths * 4.33));
  const modelWeeks = stages.reduce((n, s) => n + s.weeks, 0);
  let assigned = 0;
  stages.forEach((s, i) => {
    const w = i === stages.length - 1
      ? Math.max(1, targetWeeks - assigned)
      : Math.max(1, Math.round((s.weeks / modelWeeks) * targetWeeks));
    s.weeks = w;
    s.startWeek = assigned + 1;
    s.endWeek = assigned + w;
    assigned += w;
  });

  return {
    summary: text(raw?.summary, 600),
    stages,
    careerTips: (Array.isArray(raw?.careerTips) ? raw.careerTips : []).map((t) => text(t, 250)).filter(Boolean).slice(0, 6),
    totalWeeks: assigned,
  };
}

async function generateRoadmap(input) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a senior engineering mentor who designs realistic, industry-current learning roadmaps. You always return valid JSON.' },
          { role: 'user', content: buildPrompt(input) },
        ],
        model: MODELS.REASONING,
        ...GROQ_DEFAULTS,
        temperature: 0.5,
        max_tokens: 7000,
      });
      const raw = parseModelJson(completion.choices[0]?.message?.content || '', { context: 'roadmap' });
      const roadmap = normaliseRoadmap(raw, input);
      if (roadmap) return roadmap;
      lastError = new Error('The roadmap came back incomplete.');
    } catch (error) {
      lastError = error;
    }
  }
  const error = new Error('The roadmap could not be generated. Please try again.');
  error.status = 502;
  error.cause = lastError;
  throw error;
}

// ── diagram ────────────────────────────────────────────────────────────────

/** Characters that can break a Mermaid label even inside quotes. */
function safeLabel(value) {
  return String(value ?? '')
    .replace(/"/g, "'")
    .replace(/[<>]/g, '')
    .replace(/#(?=\w+;)/g, '♯') // "#word;" would be read as an HTML entity
    .replace(/[`|]/g, '')
    .trim();
}

/** Wrap a label onto at most `maxLines` lines of ~`width` characters. */
function wrap(value, width = 22, maxLines = 3) {
  const words = safeLabel(value).split(' ');
  const lines = [];
  let line = '';
  words.forEach((w) => {
    if ((line + ' ' + w).trim().length > width && line) {
      lines.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  });
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines.join('<br/>');
}

const weeksLabel = (s) => (s.startWeek === s.endWeek ? `Week ${s.startWeek}` : `Weeks ${s.startWeek}–${s.endWeek}`);

const INIT = {
  flowchart: {
    curve: 'basis',
    nodeSpacing: 22,
    rankSpacing: 42,
    padding: 12,
    useMaxWidth: false,
    subGraphTitleMargin: { top: 10, bottom: 6 },
  },
  themeVariables: {
    fontFamily: 'Inter, Roboto, Helvetica Neue, Arial, sans-serif',
    fontSize: '15px',
    lineColor: '#64748b',
  },
  themeCSS:
    '.cluster-label .nodeLabel, .cluster-label span { font-weight: 700 !important; letter-spacing: .01em; } ' +
    '.cluster rect { rx: 10px; ry: 10px; }',
};

/**
 * Build the roadmap diagram: a start node, one horizontal row per stage (core
 * topics, optional topics dashed, already-known topics green, the stage's
 * project last), stages linked top to bottom, ending at the goal.
 */
function buildRoadmapMermaid(roadmap, input) {
  const out = [];
  out.push(`%%{init: ${JSON.stringify(INIT)}}%%`);
  out.push('flowchart TD');
  const sub = `${input.timelineMonths} ${input.timelineMonths === 1 ? 'month' : 'months'} · ${input.hoursPerWeek} h/week`;
  out.push(`  start(["${wrap(input.role, 28, 2)}<br/><small>${sub}</small>"]):::start`);

  roadmap.stages.forEach((stage, i) => {
    const n = i + 1;
    const title = safeLabel(`STAGE ${n} · ${stage.title} · ${weeksLabel(stage)}`);
    out.push(`  subgraph S${n}["${title}"]`);
    out.push('    direction LR');
    const nodes = stage.topics.map((t, j) => {
      const cls = t.known ? 'known' : t.type;
      return `s${n}t${j + 1}("${wrap(t.name)}"):::${cls}`;
    });
    if (stage.project) nodes.push(`s${n}p[/"Project<br/>${wrap(stage.project.title, 24, 2)}"/]:::project`);
    // Invisible links keep the row in order without drawing lines between topics.
    out.push(`    ${nodes.join(' ~~~ ')}`);
    out.push('  end');
  });

  out.push(`  goal(["${wrap(`Job-ready ${input.role}`, 26, 2)}"]):::goal`);
  out.push(`  start --> ${roadmap.stages.map((_, i) => `S${i + 1}`).join(' --> ')} --> goal`);

  out.push('  classDef start fill:#0c4a6e,stroke:#0c4a6e,color:#ffffff,font-weight:600');
  out.push('  classDef goal fill:#15803d,stroke:#15803d,color:#ffffff,font-weight:600');
  out.push('  classDef core fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e,stroke-width:1.5px');
  out.push('  classDef optional fill:#ffffff,stroke:#94a3b8,color:#334155,stroke-dasharray:5 4');
  out.push('  classDef known fill:#dcfce7,stroke:#16a34a,color:#14532d');
  out.push('  classDef project fill:#fdf4ff,stroke:#c026d3,color:#701a75,stroke-width:1.5px');
  roadmap.stages.forEach((_, i) => out.push(`  style S${i + 1} fill:#f8fafc,stroke:#cbd5e1,color:#0f172a`));
  return out.join('\n');
}

module.exports = {
  LEVELS,
  readRoadmapInput,
  generateRoadmap,
  buildRoadmapMermaid,
  _internal: { normaliseRoadmap, wrap, safeLabel, buildPrompt },
};
