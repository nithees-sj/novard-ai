const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB. Throws with advice on the usual causes when it cannot.
 *
 * serverSelectionTimeoutMS is set deliberately: with Mongoose's default of
 * 30s, an unreachable cluster (an Atlas IP allowlist that does not include
 * this machine, or a local mongod that isn't running) makes every request
 * hang instead of failing, so the UI spins forever with nothing in the log.
 */
async function connectDB(uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, socketTimeoutMS: 45000 });
    logger.info(`MongoDB connected (${mongoose.connection.name})`);
  } catch (error) {
    const advice = uri.includes('mongodb+srv')
      ? 'This is an Atlas cluster. The usual causes are: (1) this machine\'s IP is not in the cluster\'s '
        + 'Network Access allowlist; (2) the user/password in MONGO_URI is wrong. For local development you can '
        + 'point MONGO_URI at a local instance instead, e.g. mongodb://127.0.0.1:27017/novard-ai'
      : 'Check that mongod is running and reachable at that address. With Docker: docker compose up mongo';
    throw Object.assign(new Error(`MongoDB connection failed: ${error.message}. ${advice}`), { cause: error });
  }
}

// Surface post-connection drops instead of letting requests quietly stall.
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected.'));
mongoose.connection.on('error', (error) => logger.error('MongoDB error', { error: error.message }));

module.exports = { connectDB };
