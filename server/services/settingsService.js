const crypto = require('crypto');
const mongoose = require('mongoose');
const Setting = require('../models/setting');
const { SETTINGS } = require('../config/admin');
const { env } = require('../config/env');
const audit = require('./auditService');
const { notFound, forbidden } = require('../utils/httpError');
const logger = require('../utils/logger');

/**
 * Runtime settings: DB override > env > code default (config/admin.js).
 *
 * Every instance keeps the overrides in memory. After `env.settingsCacheMs`
 * (30 s) it reads one small document, `__version`, and reloads everything only
 * if that changed, so a change made on one Cloud Run instance reaches all the
 * others within the TTL. The version carries a random stamp as well as a
 * counter, so a wiped collection can never look "unchanged".
 */

const VERSION_KEY = '__version';

const state = {
  values: new Map(), // key -> { value, updatedBy, updatedAt }
  stamp: null,
  checkedAt: 0,
  pending: null,
  ttlMs: env.settingsCacheMs,
};

const dbReady = () => mongoose.connection.readyState === 1;
const clone = (value) => (value === undefined ? undefined : structuredClone(value));
const isPlainObject = (x) => x && typeof x === 'object' && !Array.isArray(x);

function definition(key) {
  const def = SETTINGS[key];
  if (!def) throw notFound(`Unknown setting: ${key}`);
  return def;
}

/** Bring the cache up to date if it is older than the TTL (or `force`). */
function sync(force = false) {
  if (!dbReady()) return Promise.resolve();
  if (!force && state.stamp !== null && Date.now() - state.checkedAt < state.ttlMs) return Promise.resolve();
  if (state.pending) return state.pending;
  state.pending = (async () => {
    const meta = await Setting.findOne({ key: VERSION_KEY }).lean();
    const stamp = meta?.value?.stamp || 'none';
    if (stamp !== state.stamp) {
      const docs = await Setting.find({ key: { $ne: VERSION_KEY } }).lean();
      state.values = new Map(docs.map((d) => [d.key, { value: d.value, updatedBy: d.updatedBy, updatedAt: d.updatedAt }]));
      state.stamp = stamp;
    }
    state.checkedAt = Date.now();
  })()
    .catch((error) => logger.warn('Could not refresh runtime settings; using the cached values', { error: error.message }))
    .finally(() => { state.pending = null; });
  return state.pending;
}

/** The effective value: stored fields over the default, so new default fields appear automatically. */
function effective(key) {
  const def = definition(key);
  const fallback = def.default();
  const stored = state.values.get(key);
  if (!stored) return fallback;
  return isPlainObject(fallback) && isPlainObject(stored.value) ? { ...fallback, ...clone(stored.value) } : clone(stored.value);
}

/** The live value of a setting. */
async function get(key) {
  definition(key);
  await sync();
  return effective(key);
}

/** Several settings at once, as { key: value }. */
async function getMany(keys) {
  await sync();
  return Object.fromEntries(keys.map((k) => [k, effective(k)]));
}

/**
 * The cached value without waiting for the database (hot paths that cannot
 * await). It may be up to one TTL old; a refresh is started in the background.
 */
function peek(key) {
  sync();
  return effective(key);
}

function sourceOf(key) {
  if (state.values.has(key)) return 'db';
  const def = SETTINGS[key];
  return (def.envVars || []).some((name) => process.env[name]) ? 'env' : 'default';
}

/** Every setting with its value, default, source and whether this admin may change it. */
async function list(admin) {
  await sync();
  return Object.entries(SETTINGS).map(([key, def]) => {
    const stored = state.values.get(key);
    return {
      key,
      group: def.group,
      description: def.description,
      critical: Boolean(def.critical),
      editable: !def.critical || admin?.role === 'superadmin',
      value: effective(key),
      default: def.default(),
      source: sourceOf(key),
      updatedBy: stored?.updatedBy || null,
      updatedAt: stored?.updatedAt || null,
    };
  });
}

async function bumpVersion() {
  await Setting.updateOne(
    { key: VERSION_KEY },
    { $inc: { 'value.n': 1 }, $set: { 'value.stamp': crypto.randomBytes(8).toString('hex') } },
    { upsert: true }
  );
}

function assertMayChange(key, actor) {
  if (definition(key).critical && actor?.role !== 'superadmin') {
    throw forbidden('Only a superadmin can change this setting.', { code: 'SUPERADMIN_ONLY' });
  }
}

/**
 * Validate and save a setting. Object settings accept a partial value (the
 * missing fields keep their current value). Audited.
 *
 * @param {object} actor  { email, role } of the admin, or { email: 'system' }
 */
async function set(key, value, { actor, ip, action = 'setting.update' } = {}) {
  const def = definition(key);
  assertMayChange(key, actor);
  const before = await get(key);
  const cleaned = def.validate(value, key, before);
  await Setting.updateOne(
    { key },
    { $set: { value: cleaned, updatedBy: actor?.email || 'system' } },
    { upsert: true }
  );
  await bumpVersion();
  await sync(true);
  await audit.record({ actor, action, target: { type: 'setting', id: key }, before, after: cleaned, ip });
  return effective(key);
}

/** Remove the override, so the env/default value applies again. Audited. */
async function reset(key, { actor, ip } = {}) {
  definition(key);
  assertMayChange(key, actor);
  const before = await get(key);
  await Setting.deleteOne({ key });
  await bumpVersion();
  await sync(true);
  const after = effective(key);
  await audit.record({ actor, action: 'setting.reset', target: { type: 'setting', id: key }, before, after, ip });
  return after;
}

/** Tests: forget the cache, and optionally change its TTL (defaults to env.settingsCacheMs). */
function _reset({ ttlMs = env.settingsCacheMs } = {}) {
  state.values = new Map();
  state.stamp = null;
  state.checkedAt = 0;
  state.pending = null;
  state.ttlMs = ttlMs;
}

module.exports = { get, getMany, peek, list, set, reset, sync, VERSION_KEY, _reset };
