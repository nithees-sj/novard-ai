/**
 * Give existing items the same AI titles new ones get (ai/titles.js):
 *   - Novard Agent chats still titled with the pasted first message, a
 *     placeholder ("New chat"), or something over-long;
 *   - notes still titled with their PDF file name;
 *   - doubts whose title is over-long or reads like a pasted sentence.
 *
 *   node scripts/retitle.js            preview: counts only, changes nothing
 *   node scripts/retitle.js --apply    write the new titles
 *   --limit=N                          at most N items per kind (default 200)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const ChatbotConversation = require('../models/chatbotConversation');
const Notes = require('../models/notes');
const DoubtClearance = require('../models/doubtClearance');
const { makeTitle, isGood, isPlaceholder } = require('../ai/titles');

const APPLY = process.argv.includes('--apply');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || 200;

const looksRaw = (title = '') => {
  const t = String(title).trim();
  return isPlaceholder(t) || t.endsWith('…') || /[?!.]$/.test(t) || !isGood(t);
};
const looksLikeFile = (title = '', fileName = '') => /\.(pdf|docx?|pptx?)$/i.test(title) || (fileName && title === fileName);

async function main() {
  await mongoose.connect(env.mongoUri || process.env.MONGO_URI);
  const counts = { chats: [0, 0], notes: [0, 0], doubts: [0, 0] }; // [found, retitled]

  const chats = await ChatbotConversation.find({}, { title: 1, messages: { $slice: 2 } }).limit(5000).lean();
  for (const c of chats.filter((x) => looksRaw(x.title)).slice(0, LIMIT)) {
    counts.chats[0] += 1;
    const first = (c.messages || []).find((m) => m.role === 'user');
    const reply = (c.messages || []).find((m) => m.role === 'assistant');
    if (!first || !APPLY) continue;
    const title = await makeTitle('chat', first.content, { context: reply ? `The assistant replied: ${String(reply.content).slice(0, 600)}` : undefined, allowNone: true });
    if (title && title !== c.title) { await ChatbotConversation.updateOne({ _id: c._id }, { $set: { title } }); counts.chats[1] += 1; }
  }

  const notes = await Notes.find({}, { title: 1, fileName: 1, extractedText: 1 }).limit(5000).lean();
  for (const n of notes.filter((x) => looksLikeFile(x.title, x.fileName)).slice(0, LIMIT)) {
    counts.notes[0] += 1;
    if (!APPLY || !n.extractedText) continue;
    const title = await makeTitle('notes', n.extractedText.slice(0, 2000), { fileName: n.fileName });
    if (title && title !== n.title) { await Notes.updateOne({ _id: n._id }, { $set: { title } }); counts.notes[1] += 1; }
  }

  const doubts = await DoubtClearance.find({}, { title: 1, description: 1 }).limit(5000).lean();
  for (const d of doubts.filter((x) => looksRaw(x.title)).slice(0, LIMIT)) {
    counts.doubts[0] += 1;
    if (!APPLY) continue;
    const title = await makeTitle('doubt', d.description || d.title, { context: d.title ? `Title the student typed: ${d.title}` : undefined });
    if (title && title !== d.title) { await DoubtClearance.updateOne({ _id: d._id }, { $set: { title } }); counts.doubts[1] += 1; }
  }

  for (const [kind, [found, done]] of Object.entries(counts)) {
    console.log(`${kind.padEnd(7)} ${found} need a better title${APPLY ? `, ${done} retitled` : ''}`);
  }
  if (!APPLY) console.log('Preview only. Run with --apply to write the new titles.');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
