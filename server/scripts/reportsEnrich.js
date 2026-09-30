/**
 * Enrich reports the immediate pass missed (the model was down or busy).
 * Resumable: run it as often as you like.
 *
 *   npm run reports:enrich --prefix server [-- --limit 500]
 */
const { enrichPending } = require('../services/reportEnrichment');
const { run, print } = require('./lib/cli');

run(async ({ limit }) => {
  const result = await enrichPending({ limit: Number(limit) || 500 });
  print(`Enrichment: ${result.done} enriched, ${result.failed} failed, of ${result.considered} waiting.`);
});
