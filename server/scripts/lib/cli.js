/**
 * Shared helpers for the npm scripts: --flag value parsing and a runner that
 * connects to MongoDB, runs the task and always disconnects.
 */
const mongoose = require('mongoose');
const { env } = require('../../config/env');
const { connectDB } = require('../../config/db');

/** "--email a@b.c --role admin --clear" -> { email: 'a@b.c', role: 'admin', clear: true } */
function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [name, inline] = arg.slice(2).split('=');
    if (inline !== undefined) out[name] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) { out[name] = argv[i + 1]; i += 1; }
    else out[name] = true;
  }
  return out;
}

// eslint-disable-next-line no-console
const print = (...lines) => console.log(lines.join('\n'));

/** Connect, run `task(args)`, disconnect; exit 1 with the message on failure. */
function run(task) {
  (async () => {
    if (!env.mongoUri) throw new Error('MONGO_URI is not set (server/.env).');
    await connectDB(env.mongoUri);
    try {
      await task(parseArgs());
    } finally {
      await mongoose.disconnect();
    }
  })().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}

module.exports = { parseArgs, print, run };
