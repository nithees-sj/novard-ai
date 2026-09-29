const mongoose = require('mongoose');
const { env, missingEnv } = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const logger = require('./utils/logger');
const { terminateOcr } = require('./services/ocrService');

const missing = missingEnv();
if (missing.length > 0) {
  logger.error(`Missing required environment variable(s): ${missing.join(', ')}. Add them to server/.env (see server/.env.example).`);
  process.exit(1);
}
if (env.jwtSecretGenerated) {
  logger.warn('JWT_SECRET is not set: using a random secret, so everyone is signed out whenever the server restarts.');
}
if (!env.geminiApiKey) {
  logger.warn('Neither GEMINI_API_KEY nor GOOGLE_API_KEY is set - Udemy/Coursera/Edureka course discovery will use the built-in course list.');
}
if (env.isProduction && !env.corsOrigins.length) {
  logger.warn('CORS_ORIGINS is not set: the API accepts requests from any website origin.');
}

// Keep the process alive on a stray rejection rather than dying mid-request, but make it loud.
process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', { reason }));

async function start() {
  await connectDB(env.mongoUri);
  const server = createApp().listen(env.port, () => logger.info(`Server is running on port ${env.port}`));

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${env.port} is already in use. Stop the other process or set PORT in server/.env.`);
      process.exit(1);
    }
    throw error;
  });

  const shutdown = (signal) => () => {
    logger.info(`${signal} received - shutting down.`);
    server.close(() => {
      Promise.allSettled([mongoose.connection.close(false), terminateOcr()]).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

start().catch((error) => {
  logger.error(error.message);
  process.exit(1);
});
