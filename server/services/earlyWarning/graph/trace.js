const RiskStep = require('../../../models/riskStep');
const { runWithAi } = require('../../../ai/aiContext');
const logger = require('../../../utils/logger');

/**
 * Tracing (EWDI nodes.py trace/timed): every node writes a RiskStep, and
 * every model call made inside it carries the run id and step number, so the
 * live view can show node by node what ran, how long it took and what it cost.
 */

const seqs = new Map(); // runId -> last step number (runs execute in one process)
const nextSeq = (runId) => {
  const n = (seqs.get(runId) || 0) + 1;
  seqs.set(runId, n);
  return n;
};
const forget = (runId) => seqs.delete(runId);

async function writeStep(step) {
  try {
    await RiskStep.create({
      ...step,
      inputSummary: step.inputSummary ? String(step.inputSummary).slice(0, 800) : undefined,
      outputSummary: step.outputSummary ? String(step.outputSummary).slice(0, 800) : undefined,
      error: step.error ? String(step.error).slice(0, 400) : undefined,
    });
  } catch (error) {
    logger.warn('Could not write an investigation step', { error: error.message });
  }
}

/**
 * Wrap a node: time it, give its model calls the run context, write its step.
 * A node returns its state update plus optional `_trace` (the step's summary).
 * A node that throws becomes an error step and a `runErrors` entry, never a
 * crashed run (the graph must always finish).
 */
function timed(node, fn, { laneOf } = {}) {
  return async (state) => {
    const seq = nextSeq(state.runId);
    const lane = laneOf ? laneOf(state) : undefined;
    const started = Date.now();
    try {
      const out = await runWithAi(
        { feature: 'risk.investigation', area: state.area, runId: state.runId, stepSeq: seq },
        () => fn(state, { seq })
      ) || {};
      const { _trace: summary, ...update } = out;
      await writeStep({
        runId: state.runId, seq, node, lane, outputSummary: summary, latencyMs: Date.now() - started,
        usd: update.usage?.usd || 0, tokens: update.usage?.tokens || 0,
      });
      return update;
    } catch (error) {
      logger.warn(`Investigation node ${node} failed`, { runId: state.runId, error: error.message });
      await writeStep({ runId: state.runId, seq, node, lane, latencyMs: Date.now() - started, error: error.message });
      return { runErrors: [`${node}${lane ? `/${lane}` : ''}: ${error.message}`] };
    }
  };
}

/** A tiny semaphore: at most `limit` lanes call a model at once (Groq's per-minute token limit). */
const semaphores = new Map();
function laneSlot(runId, limit) {
  if (!semaphores.has(runId)) semaphores.set(runId, { active: 0, queue: [] });
  const s = semaphores.get(runId);
  const acquire = () => new Promise((resolve) => {
    const take = () => { s.active += 1; resolve(); };
    if (s.active < limit) take();
    else s.queue.push(take);
  });
  const release = () => {
    s.active -= 1;
    const next = s.queue.shift();
    if (next) next();
  };
  return { acquire, release };
}
const dropSlots = (runId) => semaphores.delete(runId);

module.exports = { timed, nextSeq, forget, writeStep, laneSlot, dropSlots };
