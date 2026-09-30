const { StateGraph, Send, START, END } = require('@langchain/langgraph');
const { RiskState } = require('./state');
const { timed } = require('./trace');
const nodes = require('./nodes');
const { makeSupervisor, makeLane, makeRootCause, makeVerifier, routeAfterVerify } = require('./agents');

/**
 * The investigation graph (EWDI app/graph/build.py build()):
 *
 *   buildFeatures -> scoreRisk -> resolveRiskObject --(level)--> updateMonitor -> END   (LOW/MEDIUM: zero tokens)
 *                                                  \-> supervisor --(Send x N)--> lane --> supervisor   (fan-out / fan-in)
 *                                                       supervisor -> rootCause -> verifier --> rootCause (revise, once)
 *                                                                                           --> supervisor (need more evidence)
 *                                                                                           --> predictor -> action -> END
 *
 * The lanes run in parallel and merge through the append-only `evidence` reducer.
 */

/** Dispatch one Send per chosen lane: this is the parallelism. */
function fanOut(state) {
  return (state.chosenLanes || []).map((lane) => new Send('lane', {
    runId: state.runId,
    area: state.area,
    areaLabel: state.areaLabel,
    windowEnd: state.windowEnd,
    risk: state.risk,
    lane,
    loop: state.loopCount,
    budget: state.budget,
    spent: state.usage,
  }));
}

function routeFromSupervisor(state) {
  if (state.next === 'investigate' && state.chosenLanes?.length) return fanOut(state);
  if (state.next === 'monitor') return 'updateMonitor';
  return 'rootCause';
}

/** @param {{ callJson: Function }} deps the model layer (ai/modelGateway.callJson) */
function buildGraph(deps) {
  return new StateGraph(RiskState)
    .addNode('buildFeatures', timed('buildFeatures', nodes.buildFeatures))
    .addNode('scoreRisk', timed('scoreRisk', nodes.scoreRisk))
    .addNode('resolveRiskObject', timed('resolveRiskObject', nodes.resolveRiskObject))
    .addNode('updateMonitor', timed('updateMonitor', nodes.updateMonitor))
    .addNode('supervisor', timed('supervisor', makeSupervisor(deps)))
    .addNode('lane', timed('lane', makeLane(deps), { laneOf: (s) => s.lane }))
    .addNode('rootCause', timed('rootCause', makeRootCause(deps)))
    .addNode('verifier', timed('verifier', makeVerifier(deps)))
    .addNode('predictor', timed('predictor', nodes.predictor))
    .addNode('action', timed('action', nodes.action))
    .addEdge(START, 'buildFeatures')
    .addEdge('buildFeatures', 'scoreRisk')
    .addEdge('scoreRisk', 'resolveRiskObject')
    // A conditional edge, not an agent: a rule-decidable branch costs no tokens.
    .addConditionalEdges('resolveRiskObject', nodes.routeByLevel, { supervisor: 'supervisor', updateMonitor: 'updateMonitor' })
    .addConditionalEdges('supervisor', routeFromSupervisor, ['lane', 'rootCause', 'updateMonitor'])
    .addEdge('lane', 'supervisor') // fan-in, through the evidence reducer
    .addEdge('rootCause', 'verifier')
    .addConditionalEdges('verifier', routeAfterVerify, { rootCause: 'rootCause', supervisor: 'supervisor', predictor: 'predictor' })
    .addEdge('predictor', 'action')
    .addEdge('action', END)
    .addEdge('updateMonitor', END)
    .compile();
}

module.exports = { buildGraph, fanOut, routeFromSupervisor };
