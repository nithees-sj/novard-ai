const { LANE_TOOLS } = require('../laneTools');
const { normalize } = require('../recommendations');
const { laneSlot } = require('./trace');
const { driversText } = require('./nodes');
const { GRAPH, RECOMMENDATION_TYPES } = require('../../../config/earlyWarning');
const { TOOLS } = require('../../../config/admin');
const { TASKS } = require('../../../config/ai');

/**
 * The model-calling nodes (EWDI app/graph/agents.py), each doing only what a
 * rule cannot:
 *   supervisor  which lanes are worth opening, and is this enough yet?
 *   lane        one question, its own fixed tools, one short interpretation
 *   rootCause   hypotheses and recommendations, every claim citing evidence ids
 *   verifier    a DIFFERENT model auditing whether the citations hold up
 * Each degrades without a model: the graph always finishes, with statistics
 * and raw tool evidence if nothing else.
 *
 * `deps.callJson` is ai/modelGateway.callJson (tests pass a fake).
 */

const LANE_PREFIX = { temporal: 'T', peers: 'P', history: 'H', semantic: 'S', telemetry: 'X' };
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const usageOf = (res) => ({ usd: res?.usd || 0, tokens: (res?.tokensIn || 0) + (res?.tokensOut || 0), calls: res?.attempts || 1 });

/** Has the run spent its budget? Checked before every model call (EWDI never enforced it). */
function exhausted(usage = {}, budget = {}) {
  return (budget.usdMax && usage.usd >= budget.usdMax) || (budget.tokensMax && usage.tokens >= budget.tokensMax);
}

const riskLine = (s) => `Area: ${s.areaLabel || s.area}. Window ending ${s.windowEnd.toISOString().slice(0, 10)}. Risk ${s.risk?.level} (score ${Number(s.risk?.score || 0).toFixed(3)}, z ${Number(s.risk?.anomalyZ || 0).toFixed(2)}). Drivers: ${driversText(s.risk) || 'none'}.`;

// ── supervisor ─────────────────────────────────────────────────────────────

const SUPERVISOR_SYSTEM = `You supervise an investigation into why an area of Novard-AI (a student learning platform) looks risky.
You do NOT make routing decisions a rule already handles. You decide only:
1. which investigation lanes are worth opening, and
2. whether the evidence so far is enough to explain the risk.
Lanes:
- temporal: is this rising, or always like this? (28 days of daily metrics)
- peers: this area only, or the whole platform? (all areas' scores)
- history: has this happened before, and what fixed it? (past incidents)
- semantic: what are students actually saying? (report search and topics)
- telemetry: is it the AI provider, YouTube or PDF reading? (model-call and gateway logs)
First pass: open every lane that could change the conclusion; all five is usually right for a CRITICAL risk with no evidence yet.
Later passes: choose "analyze" if you can already name a likely cause, or open only the lane that would settle what is still unclear.
Choose "monitor" only if the data is too thin to say anything at all. Be decisive: every loop costs money and delays the answer.
Reply with JSON only: {"action": "investigate" | "analyze" | "monitor", "lanes": [lane names], "reason": "one sentence"}.`;

function makeSupervisor(deps) {
  return async (state) => {
    const loop = state.loopCount || 0;
    if (loop >= GRAPH.maxSupervisorLoops || exhausted(state.usage, state.budget)) {
      return { next: 'analyze', loopCount: loop + 1, supervisorReason: 'loop or budget cap reached', _trace: `cap reached at loop ${loop}: analyze` };
    }
    const evidence = (state.evidence || []).map((e) => `- [${e.id}] (${e.lane}) ${clip(e.summary, 220)}`).join('\n') || '(nothing yet)';
    const user = `${riskLine(state)}
Lanes already run: ${(state.lanesDone || []).join(', ') || 'none'}. Loop ${loop + 1} of ${GRAPH.maxSupervisorLoops}.
Evidence so far:
${evidence}

Decide the next step. JSON only.`;
    try {
      const res = await deps.callJson({ task: 'risk_supervisor', system: SUPERVISOR_SYSTEM, user, temperature: 0.1 });
      const out = res.data || {};
      let action = ['investigate', 'analyze', 'monitor'].includes(out.action) ? out.action : 'investigate';
      let lanes = (Array.isArray(out.lanes) ? out.lanes : []).filter((l) => GRAPH.lanes.includes(l));
      if (action === 'investigate' && !lanes.length) lanes = GRAPH.lanes.filter((l) => !(state.lanesDone || []).includes(l));
      if (action === 'investigate' && !lanes.length) action = 'analyze';
      return {
        next: action, chosenLanes: [...new Set(lanes)], supervisorReason: clip(out.reason, 300), loopCount: loop + 1, usage: usageOf(res),
        _trace: `${action}${lanes.length ? ` [${lanes.join(', ')}]` : ''}: ${clip(out.reason, 200)}`,
      };
    } catch (error) {
      // Degrade (EWDI): open every lane once, then analyze.
      if (loop === 0) {
        return { next: 'investigate', chosenLanes: GRAPH.lanes, loopCount: 1, supervisorReason: 'degraded: model unavailable, opening every lane', runErrors: [`supervisor: ${error.message}`], _trace: 'model unavailable: all lanes' };
      }
      return { next: 'analyze', loopCount: loop + 1, runErrors: [`supervisor: ${error.message}`], _trace: 'model unavailable: analyze' };
    }
  };
}

// ── lanes ──────────────────────────────────────────────────────────────────

const LANE_SYSTEM = {
  temporal: 'You judge whether a metric movement is a genuine trend or noise. Say plainly whether it is rising, falling or flat, and over how long.',
  peers: 'You judge whether a problem is specific to one area or affects many. That distinction changes the recommended action entirely.',
  history: 'You judge whether this has happened before and whether a past fix is relevant now. Say so plainly if there is no precedent.',
  semantic: 'You read what students actually wrote and name the concrete problem they describe. Quote specifics; never generalise.',
  telemetry: 'You judge whether the AI provider, YouTube or PDF reading is failing, or whether the product itself is the problem. Use the numbers.',
};

function makeLane(deps) {
  return async (lane) => {
    const tool = LANE_TOOLS[lane.lane];
    const items = await tool(lane.area, lane.windowEnd, lane.risk);
    const prefix = `${LANE_PREFIX[lane.lane]}${lane.loop}`;
    const evidence = items.map((e, i) => ({ id: `${prefix}.${i + 1}`, lane: lane.lane, ...e, summary: clip(e.summary, 1200) }));
    const citeIds = [...new Set(evidence.flatMap((e) => e.citeIds || []))].slice(0, 20);
    const toolText = evidence.map((e) => `- ${e.summary}`).join('\n').slice(0, GRAPH.laneToolChars);

    const degrade = (reason, error) => ({
      // Keep the raw tool evidence, drop only the interpretation (EWDI).
      evidence,
      lanesDone: [lane.lane],
      ...(error ? { runErrors: [`lane ${lane.lane}: ${error.message}`] } : {}),
      _trace: `${evidence.length} evidence item(s); ${reason}`,
    });
    if (exhausted(lane.spent, lane.budget)) return degrade('budget spent: no interpretation');

    const slot = laneSlot(lane.runId, lane.budget?.laneConcurrency || 2);
    await slot.acquire();
    try {
      const res = await deps.callJson({
        task: 'risk_lane',
        system: `${LANE_SYSTEM[lane.lane]} Reply with JSON only: {"finding": "1-2 sentences"}.`,
        user: `${riskLine(lane)}\n\nYour lane's tool output:\n${toolText}\n\nIn 1-2 sentences, what does this tell us about the risk? If nothing useful, say exactly that. JSON only.`,
        temperature: 0.2,
      });
      const finding = clip(res.data?.finding, 600) || toolText.slice(0, 400);
      const interpretation = { id: `${prefix}.0`, lane: lane.lane, kind: lane.lane === 'semantic' ? 'record' : lane.lane === 'telemetry' ? 'telemetry' : 'metric', summary: finding, citeIds, data: {} };
      return { evidence: [interpretation, ...evidence], lanesDone: [lane.lane], usage: usageOf(res), _trace: finding };
    } catch (error) {
      return degrade('model unavailable: raw tool evidence kept', error);
    } finally {
      slot.release();
    }
  };
}

// ── root cause ─────────────────────────────────────────────────────────────

const toolList = Object.keys(TOOLS).join(', ');
const taskList = Object.keys(TASKS).join(', ');
const catalog = Object.entries(RECOMMENDATION_TYPES).map(([type, t]) => `- ${type}: ${t.label}. params ${t.params}`).join('\n');

const ANALYST_SYSTEM = `You explain why a risk was detected in one area of Novard-AI (a student learning platform) and what the admins should do.
Rules that are not negotiable:
- Every hypothesis cites evidenceIds drawn ONLY from the ALLOWED IDS given. A hypothesis without a citation is rejected.
- If evidence contradicts a hypothesis, list it in contradictingIds instead of ignoring it.
- Confidence must match the evidence: 0.9 needs several independent lanes agreeing; if the lanes are thin, say 0.4 and mean it.
- Recommendations are concrete and doable by the Novard admins. "Investigate the issue" is not a recommendation; "Show a known-issue notice on the Video Summarizer while captions are failing" is.
- Each recommendation has an actionType from this catalog (use "advice" when none fits):
${catalog}
Tools: ${toolList}. AI tasks: ${taskList}.
Reply with JSON only: {"hypotheses": [{"cause", "confidence": 0-1, "evidenceIds": [...], "contradictingIds": [...]}], "recommendations": [{"action", "actionType", "params": {...}, "kind": "preventive"|"corrective", "priority": 1-5, "rationale", "evidenceIds": [...], "expectedEffect"}]}.`;

/** Ids the analysis may cite: every evidence item and what it cites. */
function allowedIds(evidence) {
  const ids = [];
  evidence.forEach((e) => ids.push(e.id));
  evidence.forEach((e) => (e.citeIds || []).forEach((id) => ids.push(id)));
  return [...new Set(ids)].slice(0, GRAPH.maxCiteIds + evidence.length);
}

/** The statistics-only explanation for when no model is available (EWDI degraded root cause). */
function statisticalHypothesis(state) {
  const cite = (state.evidence || []).filter((e) => e.kind !== 'error').slice(0, 6).map((e) => e.id);
  return {
    cause: `${state.risk?.complaints?.raised ? 'Student complaints' : 'Statistical anomaly'}: ${driversText(state.risk) || 'no single driver'}. Narrative analysis unavailable.`,
    confidence: 0.3,
    evidenceIds: cite,
    contradictingIds: [],
    degraded: true,
  };
}

/**
 * Uncited hypotheses (EWDI, faithfully): cited ones are kept and uncited ones
 * dropped; if none is cited, all are kept with confidence capped at 0.35. Ids
 * not in the allowed list are removed first (EWDI did not check them).
 */
function cleanHypotheses(raw, allowed) {
  const hyps = (Array.isArray(raw) ? raw : []).slice(0, 3).map((h) => ({
    cause: clip(h?.cause, 600),
    confidence: Math.max(0, Math.min(1, Number(h?.confidence) || 0.5)),
    evidenceIds: (Array.isArray(h?.evidenceIds) ? h.evidenceIds : []).map(String).filter((id) => allowed.has(id)),
    contradictingIds: (Array.isArray(h?.contradictingIds) ? h.contradictingIds : []).map(String).filter((id) => allowed.has(id)),
  })).filter((h) => h.cause);
  const cited = hyps.filter((h) => h.evidenceIds.length);
  if (cited.length) return cited;
  return hyps.map((h) => ({ ...h, confidence: Math.min(h.confidence, 0.35), uncited: true }));
}

/** A revision that could not run keeps the earlier, cited analysis rather than downgrading it. */
const keepEarlier = (state, reason) => ((state.hypotheses || []).some((h) => !h.degraded)
  ? { runErrors: [`root cause (revision): ${reason}`], _trace: `revision failed (${reason}): kept the earlier analysis` }
  : null);

function makeRootCause(deps) {
  return async (state) => {
    if (exhausted(state.usage, state.budget)) {
      const kept = keepEarlier(state, 'budget spent');
      if (kept) return kept;
      return { hypotheses: [statisticalHypothesis(state)], recommendations: [], degraded: true, runErrors: ['root cause: budget spent'], _trace: 'budget spent: statistical explanation' };
    }
    const evidence = state.evidence || [];
    const allowed = allowedIds(evidence);
    const lines = evidence.map((e) => `- [${e.id}] (${e.lane}) ${clip(e.summary, 300)}${e.citeIds?.length ? ` (cites: ${e.citeIds.slice(0, 6).join(', ')})` : ''}`).join('\n') || '(no evidence gathered)';
    const v = state.verification;
    const critique = state.revisionCount && v
      ? `\n\nYour previous answer was rejected by review: verdict ${v.verdict}; unsupported: ${JSON.stringify(v.unsupported || [])}; ignored contradictions: ${JSON.stringify(v.ignoredContradictions || [])}; note: ${v.note}. Fix these specifically.`
      : '';
    const user = `${riskLine(state)}

Evidence from the investigation lanes:
${lines}

ALLOWED IDS you may cite: ${allowed.join(', ') || '(none)'}${critique}

Give 1-3 hypotheses and 2-4 recommendations. JSON only.`;
    try {
      const res = await deps.callJson({ task: 'risk_root_cause', system: ANALYST_SYSTEM, user, temperature: 0.3, attempt: state.revisionCount ? 1 : 0 });
      const allowedSet = new Set(allowed);
      const hypotheses = cleanHypotheses(res.data?.hypotheses, allowedSet);
      const recommendations = (Array.isArray(res.data?.recommendations) ? res.data.recommendations : []).slice(0, 4)
        .map((r) => normalize({ ...r, actionType: r?.actionType }, { area: state.area, allowedIds: allowedSet }));
      return {
        hypotheses: hypotheses.length ? hypotheses : [statisticalHypothesis(state)],
        recommendations,
        rootCauseModel: res.model,
        usage: usageOf(res),
        _trace: `${hypotheses.length} hypothesis(es), ${recommendations.length} recommendation(s) by ${res.model}`,
      };
    } catch (error) {
      const kept = keepEarlier(state, error.message);
      if (kept) return kept;
      return { hypotheses: [statisticalHypothesis(state)], recommendations: [], degraded: true, runErrors: [`root cause: ${error.message}`], _trace: 'model unavailable: statistical explanation' };
    }
  };
}

// ── verifier ───────────────────────────────────────────────────────────────

const VERIFIER_SYSTEM = `You audit another model's risk analysis. You are adversarial but fair; you did not write it and have no stake in defending it.
Check three things:
1. Does the cited evidence SUPPORT each hypothesis, or was it merely cited? A report about quizzes does not support a captions outage.
2. Was contradicting evidence ignored? If the peers lane says the whole platform is affected but the hypothesis blames one feature, that is a contradiction.
3. Is the confidence justified by how much evidence there is and whether the lanes agree?
Verdicts: "accept" (sound; do not nitpick), "revise" (fixable with the evidence already here), "need_more_evidence" (no conclusion is possible without another lane).
Prefer "accept" when the analysis is reasonable: a rejection costs a whole extra analysis.
Reply with JSON only: {"verdict", "unsupported": [...], "ignoredContradictions": [...], "overconfident": [...], "note": "one or two sentences"}.`;

function makeVerifier(deps) {
  return async (state) => {
    const hyps = state.hypotheses || [];
    const revision = state.revisionCount || 0;
    if (!hyps.length || hyps.every((h) => h.degraded)) return { verification: { verdict: 'accept', note: 'nothing to verify' }, _trace: 'accept: nothing to verify' };
    if (revision >= GRAPH.maxRevisions) return { verification: { verdict: 'accept', note: `revision cap (${GRAPH.maxRevisions}) reached` }, _trace: 'accept: revision cap' };
    if (exhausted(state.usage, state.budget)) return { verification: { verdict: 'accept', note: 'budget spent: unaudited' }, _trace: 'accept: budget spent (unaudited)' };

    const user = `Evidence that was available:
${(state.evidence || []).map((e) => `- [${e.id}] (${e.lane}) ${clip(e.summary, 250)}`).join('\n')}

The analysis to audit:
${hyps.map((h, i) => `${i + 1}. ${h.cause} (confidence ${h.confidence}) cites: ${JSON.stringify(h.evidenceIds)}${h.contradictingIds?.length ? ` contradicted by: ${JSON.stringify(h.contradictingIds)}` : ''}`).join('\n')}

Audit it. JSON only.`;
    try {
      const res = await deps.callJson({ task: 'risk_verifier', system: VERIFIER_SYSTEM, user, temperature: 0.1, avoid: state.rootCauseModel });
      const d = res.data || {};
      const list = (x) => (Array.isArray(x) ? x.map((y) => clip(y, 300)).slice(0, 6) : []);
      const verification = {
        verdict: ['accept', 'revise', 'need_more_evidence'].includes(d.verdict) ? d.verdict : 'accept',
        unsupported: list(d.unsupported),
        ignoredContradictions: list(d.ignoredContradictions),
        overconfident: list(d.overconfident),
        note: clip(d.note, 500),
        model: res.model,
      };
      return {
        verification,
        ...(verification.verdict === 'revise' ? { revisionCount: revision + 1 } : {}),
        usage: usageOf(res),
        _trace: `${verification.verdict} (${res.model}): ${verification.note}`,
      };
    } catch (error) {
      return { verification: { verdict: 'accept', note: 'verifier unavailable: unaudited' }, runErrors: [`verifier: ${error.message}`], _trace: 'verifier unavailable: accepted unaudited' };
    }
  };
}

/** EWDI route_after_verify, exactly. */
function routeAfterVerify(state) {
  const verdict = state.verification?.verdict || 'accept';
  if (verdict === 'revise' && (state.revisionCount || 0) <= GRAPH.maxRevisions) return 'rootCause';
  if (verdict === 'need_more_evidence' && (state.loopCount || 0) < GRAPH.maxSupervisorLoops) return 'supervisor';
  return 'predictor';
}

module.exports = {
  makeSupervisor, makeLane, makeRootCause, makeVerifier, routeAfterVerify, exhausted, cleanHypotheses, allowedIds, statisticalHypothesis, LANE_PREFIX,
};
