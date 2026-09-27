const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

/**
 * A throwaway MongoDB for one test file:
 *   useTestDatabase() in the file's top level
 * starts it before the tests, empties every collection after each test and
 * stops it at the end.
 */
function useTestDatabase() {
  let server;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri(), { dbName: 'novard-test' });
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });
}

module.exports = { useTestDatabase };
