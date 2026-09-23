const mongoose = require('mongoose');

require('dotenv').config();

/**
 * Connect to MongoDB.
 *
 * serverSelectionTimeoutMS is set deliberately: with Mongoose's default of
 * 30s, an unreachable cluster (an Atlas IP allowlist that does not include
 * this machine, or a local mongod that isn't running) makes every request
 * hang instead of failing, so the UI spins forever with nothing in the log.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('MONGO_URI is not set. Add it to server/.env before starting the server.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB connected (${mongoose.connection.name})`);
  } catch (error) {
    console.error('\nMongoDB connection failed:', error.message);

    if (uri.includes('mongodb+srv')) {
      console.error(
        '\nThis is an Atlas cluster. The usual causes are:\n' +
        '  1. This machine\'s IP is not in the cluster\'s Network Access allowlist.\n' +
        '  2. The user/password in MONGO_URI is wrong.\n' +
        '\nFor local development you can point MONGO_URI at a local instance instead:\n' +
        '  MONGO_URI=mongodb://127.0.0.1:27017/novard-ai\n'
      );
    } else {
      console.error(
        '\nCheck that mongod is running and reachable at that address. With Docker:\n' +
        '  docker compose up mongo\n'
      );
    }

    process.exit(1);
  }
};

// Surface post-connection drops instead of letting requests quietly stall.
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected.');
});
mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err.message);
});

module.exports = connectDB;
