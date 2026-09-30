const mongoose = require('mongoose');
const ModelCall = require('../../models/modelCall');
const GatewayEvent = require('../../models/gatewayEvent');
const settings = require('../settingsService');
const { env } = require('../../config/env');
const { MODELS, TASKS, PRICING } = require('../../config/ai');
const { AI_FEATURES } = require('../../config/admin');
const { runWithAi } = require('../../ai/aiContext');
const { percentile } = require('../earlyWarning/scoring');
const { badRequest, notFound } = require('../../utils/httpError');

/**
 * Every outside service the app depends on, as the console shows it: status,
 * health numbers, the settings admins may change and a "Test" call.
 *
 * API keys are NEVER returned: only whether one is configured and its last
 * four characters. Keys live in env / Secret Manager.
 */

const HOUR_MS = 3600 * 1000;
const RANGES = { '24h': 24 * HOUR_MS, '7d': 7 * 24 * HOUR_MS, '30d': 30 * 24 * HOUR_MS };

const keyInfo = (key) => ({ configured: Boolean(key), last4: key ? key.slice(-4) : null });

/** The settings each gateway page may change (everything else is refused). */
const GATEWAY_SETTINGS = {
  groq: ['ai.providers', 'ai.tiers', 'ai.routes', 'ai.failover', 'ai.params', 'ai.limits', 'risk.budget', 'assistant'],
  gemini: ['ai.providers', 'ai.routes'],
  youtube: ['gateways.youtube'],
  oauth: [],
  mongodb: [],
};

const GATEWAYS = {
  groq: { name: 'Groq (AI)', kind: 'ai', provider: 'groq' },
  gemini: { name: 'Gemini (AI)', kind: 'ai', provider: 'gemini' },
  youtube: { name: 'YouTube', kind: 'gateway', gateway: 'youtube' },
  oauth: { name: 'Google sign-in', kind: 'gateway', gateway: 'oauth' },
  mongodb: { name: 'MongoDB', kind: 'database' },
};

function lightFor(total, failures, { off = false, missing = false } = {}) {
  if (missing) return 'missing';
  if (off) return 'off';
  if (!total) return 'idle';
  const rate = failures / total;
  if (rate > 0.5) return 'down';
  if (rate > 0.1) return 'degraded';
  return 'ok';
}

async function lastHour(match) {
  const since = new Date(Date.now() - HOUR_MS);
  return match.provider
    ? ModelCall.aggregate([{ $match: { provider: match.provider, createdAt: { $gte: since }, outcome: { $ne: 'blocked' } } }, { $group: { _id: null, n: { $sum: 1 }, bad: { $sum: { $cond: [{ $eq: ['$outcome', 'ok'] }, 0, 1] } } } }])
    : GatewayEvent.aggregate([{ $match: { gateway: match.gateway, createdAt: { $gte: since }, outcome: { $in: ['ok', 'fail'] } } }, { $group: { _id: null, n: { $sum: 1 }, bad: { $sum: { $cond: [{ $eq: ['$outcome', 'fail'] }, 1, 0] } } } }]);
}

/** Status light per gateway, from the last hour. */
async function gatewayLights() {
  const [providers, youtube] = await Promise.all([settings.get('ai.providers'), settings.get('gateways.youtube')]);
  const out = {};
  await Promise.all(Object.entries(GATEWAYS).map(async ([id, g]) => {
    if (id === 'mongodb') {
      out[id] = mongoose.connection.readyState === 1 ? 'ok' : 'down';
      return;
    }
    const [row] = await lastHour(g);
    const off = (g.provider && providers[g.provider] === false) || (id === 'youtube' && !youtube.enabled);
    const missing = (id === 'groq' && !env.groqApiKey) || (id === 'gemini' && !env.geminiApiKey) || (id === 'oauth' && !env.googleClientIds.length);
    out[id] = lightFor(row?.n || 0, row?.bad || 0, { off, missing });
  }));
  return out;
}

async function listGateways() {
  const lights = await gatewayLights();
  return Object.entries(GATEWAYS).map(([id, g]) => ({
    id,
    name: g.name,
    kind: g.kind,
    status: lights[id],
    ...(id === 'groq' ? { key: keyInfo(env.groqApiKey) } : {}),
    ...(id === 'gemini' ? { key: keyInfo(env.geminiApiKey) } : {}),
  }));
}

const summarizeCalls = (rows) => {
  const n = rows.length;
  const ok = rows.filter((r) => r.outcome === 'ok');
  const lat = ok.map((r) => r.latencyMs);
  return {
    calls: n,
    errorRate: n ? (n - ok.length) / n : 0,
    rateLimited: rows.filter((r) => r.outcome === '429' || r.outcome === '429_daily').length,
    dailyQuota: rows.filter((r) => r.outcome === '429_daily').length,
    p50Ms: lat.length ? Math.round(percentile(lat, 50)) : null,
    p95Ms: lat.length ? Math.round(percentile(lat, 95)) : null,
    usd: rows.reduce((s, r) => s + (r.usd || 0), 0),
    tokens: rows.reduce((s, r) => s + (r.tokensIn || 0) + (r.tokensOut || 0), 0),
  };
};

function groupBy(rows, key) {
  const map = new Map();
  rows.forEach((r) => map.set(r[key] || 'unknown', [...(map.get(r[key] || 'unknown') || []), r]));
  return [...map.entries()].map(([k, list]) => ({ [key]: k, ...summarizeCalls(list) })).sort((a, b) => b.calls - a.calls);
}

function dailySeries(rows, days) {
  const map = new Map();
  rows.forEach((r) => {
    const d = new Date(r.createdAt).toISOString().slice(0, 10);
    map.set(d, [...(map.get(d) || []), r]);
  });
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * HOUR_MS).toISOString().slice(0, 10);
    const s = summarizeCalls(map.get(d) || []);
    out.push({ d, calls: s.calls, errorRate: s.errorRate, usd: s.usd, p95Ms: s.p95Ms });
  }
  return out;
}

async function aiDetail(provider) {
  const since = new Date(Date.now() - RANGES['30d']);
  const rows = await ModelCall.find({ provider, createdAt: { $gte: since }, outcome: { $ne: 'blocked' } })
    .select('model feature outcome latencyMs usd tokensIn tokensOut createdAt').lean();
  const within = (ms) => rows.filter((r) => Date.now() - new Date(r.createdAt).getTime() <= ms);
  const live = await settings.getMany(['ai.providers', 'ai.tiers', 'ai.routes', 'ai.failover', 'ai.params', 'ai.limits', 'risk.budget', 'assistant']);
  return {
    windows: Object.fromEntries(Object.entries(RANGES).map(([k, ms]) => [k, summarizeCalls(within(ms))])),
    byModel: groupBy(within(RANGES['7d']), 'model'),
    byFeature: groupBy(within(RANGES['7d']), 'feature'),
    daily: dailySeries(rows, 30),
    settings: live,
    reference: {
      tasks: Object.keys(TASKS),
      tiers: { REASONING: MODELS.REASONING, FAST: MODELS.FAST, GEMINI: MODELS.GEMINI, WHISPER: MODELS.WHISPER, EMBED: MODELS.EMBED },
      pricing: PRICING,
      features: Object.entries(AI_FEATURES).map(([key, f]) => ({ key, tool: f.tool, essential: f.essential })),
    },
    key: keyInfo(provider === 'groq' ? env.groqApiKey : env.geminiApiKey),
  };
}

async function eventDetail(gateway) {
  const since = new Date(Date.now() - RANGES['30d']);
  const rows = await GatewayEvent.find({ gateway, createdAt: { $gte: since } }).select('operation outcome latencyMs createdAt').lean();
  const summarize = (list) => {
    const tried = list.filter((r) => r.outcome === 'ok' || r.outcome === 'fail');
    const lat = tried.map((r) => r.latencyMs);
    return {
      events: list.length,
      ok: list.filter((r) => r.outcome === 'ok').length,
      failed: list.filter((r) => r.outcome === 'fail').length,
      missing: list.filter((r) => r.outcome === 'missing').length,
      disabled: list.filter((r) => r.outcome === 'disabled').length,
      failureRate: tried.length ? list.filter((r) => r.outcome === 'fail').length / tried.length : 0,
      p95Ms: lat.length ? Math.round(percentile(lat, 95)) : null,
    };
  };
  const within = (ms) => rows.filter((r) => Date.now() - new Date(r.createdAt).getTime() <= ms);
  const ops = [...new Set(rows.map((r) => r.operation))];
  return {
    windows: Object.fromEntries(Object.entries(RANGES).map(([k, ms]) => [k, summarize(within(ms))])),
    byOperation: ops.map((operation) => ({ operation, ...summarize(within(RANGES['7d']).filter((r) => r.operation === operation)) })),
  };
}

async function gatewayDetail(id) {
  const g = GATEWAYS[id];
  if (!g) throw notFound('Unknown gateway');
  const lights = await gatewayLights();
  const base = { id, name: g.name, kind: g.kind, status: lights[id], editableSettings: GATEWAY_SETTINGS[id] };
  if (g.provider) return { ...base, ...(await aiDetail(g.provider)) };
  if (id === 'youtube') return { ...base, ...(await eventDetail('youtube')), settings: { 'gateways.youtube': await settings.get('gateways.youtube') } };
  if (id === 'oauth') return { ...base, ...(await eventDetail('oauth')), clientIds: env.googleClientIds, note: 'Client IDs are public identifiers, shown read-only. They are set with GOOGLE_CLIENT_ID.' };
  // mongodb
  const collections = await mongoose.connection.db.listCollections().toArray();
  const counts = await Promise.all(collections.map(async (c) => ({ name: c.name, documents: await mongoose.connection.db.collection(c.name).estimatedDocumentCount() })));
  return { ...base, state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown', database: mongoose.connection.name, collections: counts.sort((a, b) => b.documents - a.documents) };
}

/** Change one of the gateway's settings (through settingsService: validated, audited). */
async function updateSetting(actor, id, { key, value, reset } = {}, { ip } = {}) {
  if (!GATEWAYS[id]) throw notFound('Unknown gateway');
  if (!GATEWAY_SETTINGS[id].includes(key)) throw badRequest(`"${key}" cannot be changed from the ${GATEWAYS[id].name} page.`);
  return reset === true ? settings.reset(key, { actor, ip }) : settings.set(key, value, { actor, ip });
}

/** One tiny call: is it reachable, and how fast? */
async function testGateway(id) {
  if (!GATEWAYS[id]) throw notFound('Unknown gateway');
  const started = Date.now();
  const done = (ok, result) => ({ ok, latencyMs: Date.now() - started, result: String(result ?? '').slice(0, 300) });
  try {
    if (id === 'groq') {
      const { complete } = require('../../ai/groqClient');
      const text = await runWithAi({ feature: 'admin.test' }, () => complete({ messages: [{ role: 'user', content: 'Reply with the single word OK.' }], model: MODELS.FAST, maxTokens: 64, temperature: 0 }));
      return done(true, text || '(empty reply)');
    }
    if (id === 'gemini') {
      const { geminiGenerate } = require('../../ai/gemini');
      return done(true, await runWithAi({ feature: 'admin.test' }, () => geminiGenerate('Reply with the single word OK.')));
    }
    if (id === 'youtube') {
      const { searchVideos } = require('../youtubeService');
      const videos = await searchVideos('learn javascript basics', 1);
      return done(videos.length > 0, videos[0]?.title || 'no results');
    }
    if (id === 'oauth') {
      const response = await fetch('https://accounts.google.com/.well-known/openid-configuration', { signal: AbortSignal.timeout(8000) });
      return done(response.ok, `HTTP ${response.status}`);
    }
    await mongoose.connection.db.admin().ping();
    return done(true, 'ping ok');
  } catch (error) {
    return done(false, error.message);
  }
}

module.exports = { gatewayLights, listGateways, gatewayDetail, updateSetting, testGateway, summarizeCalls, GATEWAY_SETTINGS, RANGES };
