/**
 * Embed reports that have no vector yet, then re-cluster each area's topics.
 * Resumable. Needs a Gemini key (GOOGLE_API_KEY); without one it only
 * re-clusters what is already embedded.
 *
 *   npm run reports:embed --prefix server [-- --limit 1000] [-- --cluster-only]
 */
const { embedPending } = require('../services/reportEmbeddings');
const { reclusterAll } = require('../services/reportTopics');
const { run, print } = require('./lib/cli');

run(async ({ limit, 'cluster-only': clusterOnly }) => {
  if (!clusterOnly) {
    const result = await embedPending({ limit: Number(limit) || 1000 });
    print(result.skipped ? `Embedding skipped: ${result.skipped}.` : `Embedded ${result.embedded} of ${result.considered} reports.`);
  }
  const topics = await reclusterAll();
  print('Topics:', ...(topics.length ? topics.map((t) => `  ${t.area}: ${t.topics} topic(s), ${t.assigned} reports assigned`) : ['  (no embeddings yet)']));
});
