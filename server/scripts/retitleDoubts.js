/**
 * One-off: give existing doubts an AI-written title from their question
 * (new doubts get one when they are created). Keeps each old title in
 * `previousTitle`, so the change can be reviewed or reverted.
 *
 *   node scripts/retitleDoubts.js            # all doubts that were never retitled
 *   node scripts/retitleDoubts.js --dry-run  # print the new titles only
 */
const mongoose = require('mongoose');
const { env } = require('../config/env');
const { connectDB } = require('../config/db');
const DoubtClearance = require('../models/doubtClearance');
const { contextualTitle } = require('../services/doubtTitle');

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  await connectDB(env.mongoUri);
  const coll = DoubtClearance.collection;
  const docs = await coll.find({ previousTitle: { $exists: false } }).project({ title: 1, description: 1 }).toArray();
  for (const d of docs) {
    // eslint-disable-next-line no-await-in-loop
    const title = await contextualTitle({ title: d.title, description: d.description });
    console.log(`"${d.title}"  ->  "${title}"`); // eslint-disable-line no-console
    // eslint-disable-next-line no-await-in-loop
    if (!dryRun && title !== d.title) await coll.updateOne({ _id: d._id }, { $set: { title, previousTitle: d.title } });
  }
  console.log(`${docs.length} doubt(s) ${dryRun ? 'checked (dry run)' : 'processed'}.`); // eslint-disable-line no-console
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); }); // eslint-disable-line no-console
