/**
 * Create (or update) the Atlas Vector Search index on report embeddings.
 * Idempotent. Works on MongoDB Atlas and on the local mongodb-atlas-local
 * image (docker-compose.yml); anywhere else the app uses text search instead.
 *
 *   npm run db:vector-index --prefix server
 */
const ReportEmbedding = require('../models/reportEmbedding');
const { EMBED_DIM } = require('../config/ai');
const { SEMANTIC } = require('../config/earlyWarning');
const { run, print } = require('./lib/cli');

const definition = {
  fields: [
    { type: 'vector', path: 'vec', numDimensions: EMBED_DIM, similarity: 'cosine' },
    { type: 'filter', path: 'area' },
    { type: 'filter', path: 'createdAt' },
  ],
};

const unsupported = (error) => [31082, 6047401, 59, 115].includes(error?.code)
  || /search index|atlas|not (supported|allowed)|command not found|SearchNotEnabled/i.test(String(error?.message));

run(async () => {
  const name = SEMANTIC.vectorIndex;
  await ReportEmbedding.createCollection().catch(() => {}); // the index needs the collection to exist
  const coll = ReportEmbedding.collection;
  try {
    const [existing] = await coll.listSearchIndexes(name).toArray();
    if (!existing) {
      await coll.createSearchIndex({ name, type: 'vectorSearch', definition });
      print(`Created vector index "${name}" (${EMBED_DIM} dimensions, cosine, filtered by area and time).`,
        'It takes a minute to build; until then the app uses text search.');
    } else if (JSON.stringify(existing.latestDefinition) !== JSON.stringify(definition)) {
      await coll.updateSearchIndex(name, definition);
      print(`Updated vector index "${name}" to the current definition.`);
    } else {
      print(`Vector index "${name}" is up to date (status: ${existing.status || 'unknown'}).`);
    }
  } catch (error) {
    if (!unsupported(error)) throw error;
    print('This MongoDB does not support Atlas Vector Search.',
      'The app works without it: similar reports are found with MongoDB text search instead.',
      'For vector search locally, use the mongodb-atlas-local image (see DOCKER_SETUP.md); in production, MongoDB Atlas.');
  }
});
