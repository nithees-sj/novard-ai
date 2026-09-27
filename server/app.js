const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { env } = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

/** Allowed browser origins; with none configured, any origin may call the API (it uses bearer tokens, not cookies). */
function corsOptions() {
  if (!env.corsOrigins.length) return { origin: true };
  return {
    origin: (origin, callback) => callback(null, !origin || env.corsOrigins.includes(origin)),
  };
}

/** Logs each request with its status and duration (debug level; errors are logged by the error handler). */
function requestLogger(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
}

/** The Express application, without a listening server or a database connection (tests create their own). */
function createApp() {
  const app = express();

  app.set('trust proxy', env.trustProxy);
  app.use(helmet());
  app.use(cors(corsOptions()));
  app.use(requestLogger);
  app.use(express.json({ limit: env.jsonBodyLimit }));

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', database: mongoose.connection.readyState === 1 ? 'up' : 'down' });
  });
  app.get('/', (req, res) => res.status(200).send('NOVARD-AI API is running'));

  app.use(apiLimiter);
  app.use(routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
