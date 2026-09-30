const { AsyncLocalStorage } = require('async_hooks');

/**
 * Who and what an AI call is for, without passing it through every service:
 *   { feature, area, userId, task, runId, stepSeq, conversationId }
 *
 * Set per request by the aiFeature() middleware (middleware/featureGate.js),
 * and by the investigation graph and the admin assistant. The model-call log
 * and the usage guard read it.
 */
const storage = new AsyncLocalStorage();

/** The current AI context ({} outside any). */
const currentAi = () => storage.getStore() || {};

/** Run fn with extra context layered over the current one. */
const runWithAi = (context, fn) => storage.run({ ...currentAi(), ...context }, fn);

module.exports = { currentAi, runWithAi };
