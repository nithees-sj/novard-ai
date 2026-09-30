const Report = require('../../models/report');
const RiskAssessment = require('../../models/riskAssessment');
const consoleService = require('../admin/consoleService');
const gateways = require('../admin/gatewayService');
const { costs } = require('../admin/costService');
const users = require('../admin/usersService');
const reports = require('../reportService');
const { searchReports } = require('../reportEmbeddings');
const { resolveArea } = require('../reportAreas');
const { listRuns } = require('../earlyWarning/runs');
const { TOOLS: APP_TOOLS } = require('../../config/admin');
const { TASKS } = require('../../config/ai');

/**
 * The admin assistant's tools (EWDI app/agent/tools.py, in Novard terms).
 *
 * Read tools answer from the same services as the console pages. Mutating
 * tools never act during the turn: they put a confirmation card in the chat,
 * and only the admin's Confirm runs it, through the console's own service
 * (agent: conversations.js). Schemas are loose on purpose (Groq rejects a call
 * whose arguments break a strict schema): every argument may be null, allowed
 * values are described, and the server filters and checks them.
 */

const MAX_RESULT_CHARS = 3500; // what the model reads (EWDI)
const LOG_RESULT_CHARS = 2000; // what is stored with the turn (EWDI)

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const r3 = (x) => Math.round((x || 0) * 1000) / 1000;
const str = (description) => ({ type: ['string', 'null'], description });
const int = (description) => ({ type: ['integer', 'null'], description });
const fn = (name, description, properties = {}) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties } } });

async function areaOrNull(value) {
  if (!value) return null;
  const area = await resolveArea(String(value).trim().toLowerCase().replace(/\s+&?\s*/g, '-'));
  if (area) return area;
  const { activeAreas } = require('../reportAreas');
  const hit = (await activeAreas()).find((a) => a.label.toLowerCase().includes(String(value).toLowerCase()));
  return hit ? hit.id : null;
}

const READ = {
  risk_board: {
    tool: fn('risk_board', 'Every app area\'s current risk level, score, top drivers and open reports. Use for "what is at risk", "how is the platform doing".'),
    args: [],
    run: async () => {
      const { areas, lastRescanAt } = await consoleService.board({ rescan: false });
      return { scoredAt: lastRescanAt, areas: areas.map((a) => ({ area: a.area, label: a.label, level: a.level, score: r3(a.score), drivers: a.drivers.map((d) => `${d.label} +${d.z}σ`), openReports: a.openReports, urgentReports: a.urgentReports, tracking: a.riskObject?.state || null })) };
    },
  },
  area_detail: {
    tool: fn('area_detail', 'One area in depth: level, score, what drives it, open reports and past investigations.', { area: str('An area id or name, e.g. "video-summarizer" or "Notes"') }),
    args: ['area'],
    run: async ({ area }) => {
      const id = await areaOrNull(area);
      if (!id) return { error: 'Unknown area. Call risk_board to see the areas.' };
      const d = await consoleService.areaDetail(id);
      return {
        area: d.area, label: d.label, level: d.latest?.level, score: r3(d.latest?.score), status: d.latest?.status,
        drivers: (d.latest?.drivers || []).map((x) => `${x.label} +${x.z}σ`),
        lastSevenDays: d.series.slice(-7).map((s) => ({ day: s.d, reports: s.reports, aiErrorRate: s.aiErrorRate === null ? null : r3(s.aiErrorRate) })),
        openReports: d.openReports.length,
        investigations: d.assessments.slice(0, 3).map((a) => ({ runId: a.runId, outcome: a.outcome, topCause: a.topCause, usd: r3(a.budget?.usdUsed) })),
      };
    },
  },
  list_reports: {
    tool: fn('list_reports', 'Students\' problem reports, newest first.', {
      area: str('Area id or name'), status: str('open | in_progress | resolved | closed'), urgency: str('high | medium | low'), limit: int('1-50, default 15'),
    }),
    args: ['area', 'status', 'urgency', 'limit'],
    run: async ({ area, status, urgency, limit }) => {
      const query = { limit: Math.max(1, Math.min(50, Number(limit) || 15)) };
      if (area) query.area = (await areaOrNull(area)) || area;
      if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) query.status = status;
      if (urgency && ['high', 'medium', 'low'].includes(urgency)) query.urgency = urgency;
      const out = await reports.listForAdmin(query);
      return { total: out.total, reports: out.reports.map((r) => ({ ref: r.ref, area: r.area, status: r.status, urgency: r.enrichment?.urgency || null, topic: r.enrichment?.topic || null, text: clip(r.text, 150), sent: r.createdAt })) };
    },
  },
  search_reports: {
    tool: fn('search_reports', 'Find reports about a problem by meaning or words ("captions missing", "quiz answer wrong").', { query: str('What to look for'), area: str('Optional area') }),
    args: ['query', 'area'],
    run: async ({ query, area }) => {
      const q = clip(query, 200);
      if (!q) return { error: 'Say what to search for.' };
      const id = await areaOrNull(area);
      const to = new Date();
      const from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      if (id) {
        const out = await searchReports({ area: id, from, to, query: q });
        return { mode: out.mode, matches: out.matches };
      }
      const terms = (q.toLowerCase().match(/[a-z0-9]{3,}/g) || []).join(' ');
      const rows = await Report.find({ createdAt: { $gte: from }, $text: { $search: terms } }, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } }).limit(12).lean();
      return { mode: 'full-text', matches: rows.map((r) => ({ ref: r.ref, area: r.area, status: r.status, text: clip(r.text, 180) })) };
    },
  },
  gateway_status: {
    tool: fn('gateway_status', 'Health of Groq, Gemini, YouTube, Google sign-in and MongoDB: status, calls, error rates, latency, spend.', { gateway: str('Optional: groq | gemini | youtube | oauth | mongodb') }),
    args: ['gateway'],
    run: async ({ gateway }) => {
      if (!gateway) return { gateways: (await gateways.listGateways()).map(({ id, name, status }) => ({ id, name, status })) };
      const g = await gateways.gatewayDetail(String(gateway).toLowerCase());
      return { id: g.id, name: g.name, status: g.status, windows: g.windows, byModel: (g.byModel || []).slice(0, 5), byOperation: g.byOperation };
    },
  },
  cost_report: {
    tool: fn('cost_report', 'AI spend and usage: total, by model, by feature, investigations and this assistant.', { scope: str('24h | 7d | 30d (default 7d)') }),
    args: ['scope'],
    run: async ({ scope }) => {
      const c = await costs({ range: ['24h', '7d', '30d'].includes(scope) ? scope : '7d' });
      const pick = (s) => ({ calls: s.calls, usd: r3(s.usd), tokens: s.tokens, errorRate: r3(s.errorRate) });
      return {
        range: c.range, total: pick(c.total), today: { usd: r3(c.today.usd), cap: c.today.cap },
        byModel: c.byModel.slice(0, 5).map((m) => ({ model: m.model, ...pick(m) })),
        byFeature: c.byFeature.slice(0, 8).map((f) => ({ feature: f.feature, ...pick(f) })),
        investigations: pick(c.investigations), assistant: pick(c.assistant),
      };
    },
  },
  recent_runs: {
    tool: fn('recent_runs', 'The latest investigations, with outcome and cost.', { limit: int('1-25, default 8') }),
    args: ['limit'],
    run: async ({ limit }) => ({ runs: (await listRuns({ limit: Math.max(1, Math.min(25, Number(limit) || 8)) })).runs.map((r) => ({ runId: r.runId, area: r.area, status: r.status, outcome: r.outcome, usd: r3(r.budget?.usdUsed), tokens: r.budget?.tokensUsed, started: r.startedAt })) }),
  },
  run_findings: {
    tool: fn('run_findings', 'What one investigation found: hypotheses with confidence, the review verdict and recommendations.', { runId: str('e.g. run_1a2b3c4d5e6f') }),
    args: ['runId'],
    run: async ({ runId }) => {
      const a = await RiskAssessment.findOne({ runId: clip(runId, 40) }).lean();
      if (!a) return { error: 'No such run. Call recent_runs.' };
      return {
        runId: a.runId, area: a.area, status: a.status, outcome: a.outcome, degraded: a.degraded, usd: r3(a.budget?.usdUsed), tokens: a.budget?.tokensUsed,
        hypotheses: (a.hypotheses || []).map((h) => ({ cause: h.cause, confidence: h.confidence, cites: (h.evidenceIds || []).slice(0, 6) })),
        review: a.verification ? { verdict: a.verification.verdict, note: a.verification.note } : null,
        recommendations: (a.recommendations || []).map((r) => ({ action: r.action, type: r.actionType, status: r.status })),
        outlook: a.predictions ? { pIncident: a.predictions.pIncident, whatif: a.predictions.whatif } : null,
      };
    },
  },
  platform_stats: {
    tool: fn('platform_stats', 'Headline numbers: users, active today, reports open and urgent, AI spend today, gateway lights.'),
    args: [],
    run: async () => {
      const o = await consoleService.overview();
      return { users: o.users, reports: o.reports, riskLevels: o.risk.levels, aiSpendToday: r3(o.ai.spendToday), dailyCap: o.ai.dailyCap, gateways: o.gateways, openAlerts: o.alerts.length };
    },
  },
  user_lookup: {
    tool: fn('user_lookup', 'Find accounts by name or email (emails come back masked).', { query: str('Name or part of an email') }),
    args: ['query'],
    run: async ({ query }) => {
      const out = await users.listUsers({ q: clip(query, 100), limit: 10 });
      return { total: out.total, users: out.users.map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, status: u.status, lastActiveDay: u.lastActiveDay })) };
    },
  },
};

/**
 * Mutating tools: the model can only PROPOSE these. `prepare` checks and
 * cleans the arguments and returns the card's args and a one-line summary.
 */
const MUTATING = {
  start_investigation: {
    tool: fn('start_investigation', 'Propose running an investigation of one area (a confirmation card; nothing runs until the admin confirms). Costs a few cents of AI.', { area: str('Area id or name') }),
    args: ['area'],
    prepare: async ({ area }) => {
      const id = await areaOrNull(area);
      if (!id) return { error: 'Unknown area. Call risk_board to see the areas.' };
      return { args: { area: id }, summary: `Investigate ${id}` };
    },
  },
  resolve_reports: {
    tool: fn('resolve_reports', 'Propose resolving reports (a confirmation card): every open report in an area, or specific refs. Each student is notified once with the note.', {
      area: str('Area id or name (resolves all its open reports)'), refs: { type: ['array', 'null'], items: { type: 'string' }, description: 'Report refs like NV-1A2B3C4D' }, note: str('What was done, for the students'),
    }),
    args: ['area', 'refs', 'note'],
    prepare: async ({ area, refs, note }) => {
      const list = Array.isArray(refs) ? refs.map((r) => clip(r, 12).toUpperCase()).filter((r) => /^NV-[0-9A-F]{8}$/.test(r)).slice(0, 200) : [];
      const id = list.length ? null : await areaOrNull(area);
      if (!list.length && !id) return { error: 'Say which area, or which report refs.' };
      const open = await Report.countDocuments(list.length ? { ref: { $in: list }, open: true } : { area: id, open: true });
      if (!open) return { error: 'There are no open reports matching that.' };
      return { args: { ...(id ? { area: id } : { refs: list }), note: clip(note, 1000) }, summary: `Resolve ${open} open report(s)${id ? ` in ${id}` : ''}${note ? ' with a note' : ''}` };
    },
  },
  set_feature_flag: {
    tool: fn('set_feature_flag', `Propose switching a student tool on or off (a confirmation card). Tools: ${Object.keys(APP_TOOLS).join(', ')}.`, {
      feature: str('The tool'), enabled: { type: ['boolean', 'null'] }, message: str('What students see while it is off'),
    }),
    args: ['feature', 'enabled', 'message'],
    prepare: async ({ feature, enabled, message }) => {
      if (!APP_TOOLS[feature]) return { error: `Unknown tool. One of: ${Object.keys(APP_TOOLS).join(', ')}.` };
      if (typeof enabled !== 'boolean') return { error: 'Say whether to switch it on (true) or off (false).' };
      return { args: { feature, enabled, message: clip(message, 300) }, summary: `${enabled ? 'Switch on' : 'Switch off'} ${APP_TOOLS[feature].label}` };
    },
  },
  set_model_route: {
    tool: fn('set_model_route', `Propose routing an AI task to a model (a confirmation card). Tasks: ${Object.keys(TASKS).join(', ')}.`, { task: str('The task'), model: str('Model id, e.g. openai/gpt-oss-20b') }),
    args: ['task', 'model'],
    prepare: async ({ task, model }) => {
      if (!TASKS[task]) return { error: `Unknown task. One of: ${Object.keys(TASKS).join(', ')}.` };
      if (!/^[\w./:-]{2,100}$/.test(String(model || ''))) return { error: 'Give a model id, e.g. openai/gpt-oss-20b.' };
      return { args: { task, model: String(model) }, summary: `Route ${task} to ${model}` };
    },
  },
};

/** Keep only the arguments a tool accepts (EWDI's allow-list), dropping empty ones. */
function allowedArgs(def, raw) {
  const args = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(def.args.filter((k) => args[k] !== undefined && args[k] !== null && args[k] !== '').map((k) => [k, args[k]]));
}

const TOOL_DEFS = [...Object.values(READ).map((d) => d.tool), ...Object.values(MUTATING).map((d) => d.tool)];

module.exports = { READ, MUTATING, TOOL_DEFS, allowedArgs, MAX_RESULT_CHARS, LOG_RESULT_CHARS };
