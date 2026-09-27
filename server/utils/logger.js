/**
 * Minimal levelled logger.
 *
 * Production writes one JSON object per line (what Cloud Run / Docker log
 * collectors expect); development prints readable lines. Tests are silent
 * unless LOG_LEVEL is set. Level: LOG_LEVEL = error | warn | info | debug | silent.
 */

const LEVELS = { silent: -1, error: 0, warn: 1, info: 2, debug: 3 };

function threshold() {
  const configured = process.env.LOG_LEVEL;
  if (configured && configured in LEVELS) return LEVELS[configured];
  if (process.env.NODE_ENV === 'test') return LEVELS.silent;
  return process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;
}

const useJson = () => process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';

/** Errors do not survive JSON.stringify; keep what is useful for debugging. */
function serialize(value) {
  if (value instanceof Error) {
    const out = { message: value.message, name: value.name };
    if (value.status) out.status = value.status;
    if (value.code) out.code = value.code;
    if (value.stack) out.stack = value.stack;
    if (value.cause) out.cause = serialize(value.cause);
    return out;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, v instanceof Error ? serialize(v) : v]));
  }
  return value;
}

function write(level, message, meta) {
  if (LEVELS[level] > threshold()) return;
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;

  if (useJson()) {
    const extra = meta === undefined ? {} : serialize(meta instanceof Error ? { error: meta } : meta);
    stream.write(`${JSON.stringify({ level, time: new Date().toISOString(), msg: message, ...extra })}\n`);
    return;
  }

  const time = new Date().toISOString().slice(11, 19);
  const args = [`${time} ${level.toUpperCase().padEnd(5)} ${message}`];
  if (meta !== undefined) args.push(meta);
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(...args);
}

const logger = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};

module.exports = logger;
