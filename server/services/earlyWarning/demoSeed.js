const crypto = require('crypto');
const Report = require('../../models/report');
const ModelCall = require('../../models/modelCall');
const GatewayEvent = require('../../models/gatewayEvent');
const Notification = require('../../models/notification');
const AreaFeature = require('../../models/areaFeature');
const RiskScore = require('../../models/riskScore');
const RiskAlert = require('../../models/riskAlert');
const RiskObject = require('../../models/riskObject');
const RiskPrecedent = require('../../models/riskPrecedent');
const RiskAssessment = require('../../models/riskAssessment');
const RiskStep = require('../../models/riskStep');
const { activeAreas } = require('../reportAreas');
const { rescanAll } = require('./rescan');
const { MODELS } = require('../../config/ai');
const { AI_FEATURES } = require('../../config/admin');

/**
 * Manufacture a genuine risk escalation in one area, for demos (EWDI
 * app/seed/demo_risk.py). It does NOT fake an alert: it seeds the data an
 * incident would produce (a quiet 28-day baseline everywhere, then a ramping
 * spike of urgent, angry, unanswered reports with rising caption failures and
 * AI errors in one area) and runs the normal scoring pass. The alert that
 * appears is the detector reacting to data.
 *
 * Everything created is tagged `demo: true` (demo students use @novard.demo
 * addresses), and clearDemo() removes exactly that.
 */

const DAY_MS = 24 * 3600 * 1000;
const DEMO_DOMAIN = '@novard.demo';
const BASELINE_DAYS = 34;
const SPIKE_DAYS = 6;

/** A small seeded random generator, so a demo is reproducible. */
function rng(seed = 11) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    uniform: (lo, hi) => lo + next() * (hi - lo),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
  };
}

// What students write, per area: a spike is only convincing if the evidence
// reads like the area it landed in.
const SPIKE_TEXT = {
  'video-summarizer': [
    'The summary for my video is completely empty and it says no transcript is available. It worked last week.',
    'Captions will not load for any video I add, so the chat cannot answer anything about the video.',
    'I added {d} videos today and every single one says "Transcript not available". The summaries are useless.',
    'The video summary is just the title repeated. The captions tab is blank even though the video has subtitles on YouTube.',
    'Adding a YouTube link takes forever and then the summary says it could not read the video.',
  ],
  notes: [
    'My PDF uploaded but the chat says it cannot find any text in it, and it is a typed document.',
    'Uploading notes fails with "could not read that PDF" for every file I try.',
    'The notes chat answers questions that have nothing to do with my PDF.',
  ],
  quizzes: [
    'The quiz marked my correct answer as wrong again. The answer key is clearly broken.',
    'Two options in the quiz are identical and both are marked wrong.',
    'The quiz explanation contradicts the answer it marks as correct.',
  ],
  doubts: [
    'The doubt answer stops halfway and then the chat will not reply at all.',
    'Every doubt I ask gets "The AI is busy right now" for the last {d} days.',
  ],
  agent: [
    'The Novard Agent keeps saying it created my roadmap but nothing appears.',
    'The agent does not reply at all, it just spins.',
  ],
};
const GENERIC_SPIKE = ['This has been broken for {d} days and nobody has replied to my earlier report.', 'Nothing works in this part of the app today. I have lost my progress twice.'];
const BASELINE_TEXT = [
  'A small thing: the button text is cut off on my laptop screen.',
  'It would be nice if this remembered my last settings.',
  'The answer was a bit long, but it was correct.',
  'Loading was slow once today, but it worked in the end.',
  'Could you add a dark mode for this page?',
];
const TOPICS = {
  'video-summarizer': ['missing video captions', 'empty video summary', 'slow video import'],
  notes: ['pdf text not found', 'pdf upload failure'],
  quizzes: ['wrong quiz answer', 'duplicate quiz options'],
  doubts: ['incomplete doubt answer', 'ai busy errors'],
  agent: ['agent not creating items', 'agent not replying'],
};

const featuresOf = (area) => Object.entries(AI_FEATURES).filter(([, f]) => f.area === area).map(([k]) => k);
const newRef = () => `NV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const at = (dayStart, r) => new Date(dayStart + r.int(6, 22) * 3600 * 1000 + r.int(0, 59) * 60 * 1000);

/**
 * Seed a baseline for every area and a spike in `area`. `student` (optional)
 * gets a couple of the spike reports, so they receive the "resolved"
 * notification at the end of the demo.
 */
async function seedDemo({ area = 'video-summarizer', student, now = new Date(), seed = 11 } = {}) {
  const areas = (await activeAreas()).map((a) => a.id);
  if (!areas.includes(area)) throw new Error(`Unknown area "${area}". One of: ${areas.join(', ')}`);
  const r = rng(seed);
  const todayStart = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const reports = [];
  const calls = [];
  const events = [];
  let studentN = 0;
  const demoStudent = () => { studentN += 1; return `demo-student-${studentN}${DEMO_DOMAIN}`; };

  for (let back = BASELINE_DAYS + SPIKE_DAYS - 1; back >= 0; back -= 1) {
    const dayStart = todayStart - back * DAY_MS;
    for (const a of areas) {
      const spiking = a === area && back < SPIKE_DAYS;
      const ramp = spiking ? 1 - back / (SPIKE_DAYS + 1) : 0; // worst on the newest day, so the slope is positive too

      // Reports
      const n = spiking ? Math.round(10 + 22 * ramp) : r.int(3, 6);
      for (let i = 0; i < n; i += 1) {
        const createdAt = at(dayStart, r);
        const answered = !spiking && r.chance(0.85);
        const firstResponseAt = answered ? new Date(createdAt.getTime() + r.int(1, 8) * 3600 * 1000) : undefined;
        const topics = TOPICS[a] || ['general issue'];
        reports.push({
          ref: newRef(),
          userId: demoStudent(),
          userName: `Demo student ${studentN}`,
          area: a,
          routedBy: 'context',
          text: (spiking ? r.pick([...(SPIKE_TEXT[a] || []), ...GENERIC_SPIKE]) : r.pick(BASELINE_TEXT)).replace('{d}', r.int(2, 6)),
          channel: 'text',
          source: spiking && r.chance(0.6) ? { page: '/video', tool: a, itemType: 'video_summary', excerpt: 'Transcript not available for this video.' } : { page: '/home' },
          enrichment: {
            status: 'done',
            urgency: spiking ? (r.chance(0.6 + 0.3 * ramp) ? 'high' : 'medium') : r.pick(['low', 'low', 'medium']),
            sentiment: Number((spiking ? r.uniform(-0.95, -0.55) : r.uniform(-0.4, 0.1)).toFixed(2)),
            intent: spiking ? 'bug' : r.pick(['content_quality', 'feature_request', 'other']),
            topic: spiking ? r.pick(topics) : 'minor feedback',
            isRepeat: spiking ? r.chance(0.5 + 0.3 * ramp) : r.chance(0.05),
            model: 'fixture',
            promptVersion: 'demo-v1',
            at: createdAt,
          },
          status: answered ? 'resolved' : 'open',
          open: !answered,
          quotaSlot: answered ? undefined : 0,
          firstResponseAt,
          resolvedAt: answered ? firstResponseAt : undefined,
          createdAt,
          updatedAt: createdAt,
          demo: true,
        });
      }

      // AI calls for the area's features
      const features = featuresOf(a);
      if (features.length) {
        const nCalls = r.int(35, 50);
        const errorRate = spiking ? 0.15 + 0.35 * ramp : 0.02;
        for (let i = 0; i < nCalls; i += 1) {
          const failed = r.chance(errorRate);
          calls.push({
            feature: r.pick(features), area: a, provider: 'groq', model: r.pick([MODELS.FAST, MODELS.REASONING]),
            tokensIn: failed ? 0 : r.int(600, 3000), tokensOut: failed ? 0 : r.int(80, 600), usd: 0,
            latencyMs: failed ? r.int(200, 900) : r.int(900, 3500) * (spiking ? 1.5 : 1), attempt: 1,
            outcome: failed ? r.pick(['5xx', '429', '5xx']) : 'ok', routedBy: 'default', createdAt: at(dayStart, r), demo: true,
          });
        }
      }

      // YouTube: caption and search calls (where the area uses YouTube)
      if (['video-summarizer', 'video-library', 'doubts', 'skill-unlocker'].includes(a)) {
        const nEvents = r.int(15, 25);
        const failRate = a === area && spiking ? 0.3 + 0.5 * ramp : 0.03;
        for (let i = 0; i < nEvents; i += 1) {
          events.push({
            gateway: 'youtube', operation: a === 'video-summarizer' ? r.pick(['captions', 'metadata']) : 'search',
            outcome: r.chance(failRate) ? 'fail' : 'ok', latencyMs: r.int(150, 1200), area: a,
            error: undefined, createdAt: at(dayStart, r), demo: true,
          });
        }
      }
    }
  }

  // Give the real student (if any) up to two open spike reports in the area.
  if (student) {
    const email = String(student).trim().toLowerCase();
    reports
      .filter((rep) => rep.area === area && rep.open)
      .slice(-2)
      .forEach((rep, i) => Object.assign(rep, { userId: email, userName: 'You (demo)', quotaSlot: i }));
  }

  await Report.insertMany(reports, { ordered: false });
  await ModelCall.insertMany(calls, { ordered: false });
  await GatewayEvent.insertMany(events, { ordered: false });

  // A fresh, visible escalation every time (EWDI deletes the area's alerts too).
  await RiskAlert.deleteMany({ area });
  const scan = await rescanAll({ now, full: true, trigger: 'cli', demo: true });
  return {
    area,
    reports: reports.length,
    spikeReports: reports.filter((rep) => rep.area === area && rep.open).length,
    modelCalls: calls.length,
    gatewayEvents: events.length,
    alerts: scan.alerts || [],
    skipped: Boolean(scan.skipped),
  };
}

/** Remove everything the demo created, then rescore from the real data. */
async function clearDemo({ now = new Date() } = {}) {
  const demo = { demo: true };
  const [reports, calls, events] = await Promise.all([
    Report.deleteMany(demo),
    ModelCall.deleteMany(demo),
    GatewayEvent.deleteMany(demo),
  ]);
  const runs = await RiskAssessment.find(demo).select('runId').lean();
  await Promise.all([
    Notification.deleteMany({ userId: { $regex: `${DEMO_DOMAIN.replace('.', '\\.')}$` } }),
    RiskStep.deleteMany({ runId: { $in: runs.map((x) => x.runId) } }),
    RiskAssessment.deleteMany(demo),
    RiskAlert.deleteMany(demo),
    RiskObject.deleteMany(demo),
    RiskPrecedent.deleteMany(demo),
    AreaFeature.deleteMany({}),
    RiskScore.deleteMany({}),
  ]);
  await rescanAll({ now, full: true, trigger: 'cli' });
  return { reports: reports.deletedCount, modelCalls: calls.deletedCount, gatewayEvents: events.deletedCount };
}

module.exports = { seedDemo, clearDemo, DEMO_DOMAIN };
