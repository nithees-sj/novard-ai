/* eslint-disable no-console */
/**
 * Client logging. Errors are always reported (so they reach the browser
 * console and any error tracker hooked in later); debug output is dropped in
 * production builds.
 */
const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  error: (message, error) => console.error(message, error ?? ''),
  warn: (message, detail) => { if (!isProduction) console.warn(message, detail ?? ''); },
  debug: (message, detail) => { if (!isProduction) console.debug(message, detail ?? ''); },
};

export default logger;
