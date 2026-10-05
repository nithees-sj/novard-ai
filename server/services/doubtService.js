const youtubeSearch = require('youtube-search-api');
const DoubtClearance = require('../models/doubtClearance');
const { MODELS } = require('../config/ai');
const { MARKDOWN_WITH_FLOWCHART } = require('../config/prompts');
const { complete } = require('../ai/groqClient');
const { converse } = require('../ai/conversation');
const { FORMAT_RULES } = require('../ai/prompts');
const { parseModelJson } = require('../utils/parseModelJson');
const { mapWithConcurrency } = require('../utils/concurrency');
const { readQuizOptions, generateQuiz, sampleContent } = require('./quizService');
const { condenseToFit } = require('../ai/condense');
const { contextualTitle } = require('./doubtTitle');
const { badRequest, notFound, upstreamError } = require('../utils/httpError');
const { objectId, text, integer, httpUrl } = require('../utils/validate');
const logger = require('../utils/logger');
const gateway = require('./gatewayEvents');

/** Doubt Clearance: a student's questions, each with a tutoring chat, summary, quizzes and videos. */

const MIN_MESSAGES_FOR_EXTRAS = 4; // two questions and two answers

async function listDoubts(userId) {
  return DoubtClearance.find({ userId }).sort({ createdAt: -1 }).select('-memory').lean();
}

async function findOwnDoubt(userId, doubtId, select) {
  const query = DoubtClearance.findOne({ _id: objectId(doubtId, 'doubt id'), userId });
  if (select) query.select(select);
  const doubt = await query;
  if (!doubt) throw notFound('Doubt clearance not found');
  return doubt;
}

/**
 * Validate and save a new doubt. Shared by the Doubt Clearance page and the Novard Agent.
 * The title is written by the AI from the question (the student's own title, if any,
 * is only a hint); `keepTitle` keeps a title that is already specific, e.g. the agent's.
 */
async function createDoubt({ title, description, imageUrl, userId }, { keepTitle = false } = {}) {
  if (typeof description !== 'string' || !description.trim() || !userId) {
    throw badRequest('Describe your doubt, and include userId.');
  }
  // Same limits as the schema, reported clearly instead of as a generic 500.
  const ownTitle = text(title, 'The title', { required: false, max: 200 });
  const cleanDescription = text(description, 'The description', { max: 2000, collapse: false });

  let image = null;
  if (imageUrl && String(imageUrl).trim()) {
    image = httpUrl(String(imageUrl).trim());
    if (!image) throw badRequest('The image link must be a full http:// or https:// URL.');
  }

  const finalTitle = keepTitle && ownTitle
    ? ownTitle
    : await contextualTitle({ title: ownTitle, description: cleanDescription });

  return DoubtClearance.create({
    title: finalTitle,
    description: cleanDescription,
    imageUrl: image,
    userId,
    chatHistory: [],
    summary: '',
    quizzes: [],
    youtubeRecommendations: [],
  });
}

async function deleteDoubt({ userId, doubtId }) {
  const result = await DoubtClearance.deleteOne({ _id: objectId(doubtId, 'doubt id'), userId });
  if (!result.deletedCount) throw notFound('Doubt clearance not found');
}

async function chatWithDoubt({ userId, doubtId, message }) {
  const question = text(message, 'Message', { max: 4000, collapse: false });
  const doubt = await findOwnDoubt(userId, doubtId, 'title description imageUrl');

  const system = `You are a patient tutor helping a student clear one specific doubt.

THE DOUBT
Title: ${doubt.title}
Details: ${doubt.description}${doubt.imageUrl ? `\nThe student attached an image link (you cannot see it): ${doubt.imageUrl}` : ''}

Teaching approach:
- Find the exact point of confusion and address that first, in plain language.
- Build understanding step by step; use a concrete example, analogy or code where it helps.
- When there is a common misconception behind the doubt, name it.
- If the student seems stuck, check understanding with a quick question at the end.

${FORMAT_RULES}`;

  // The whole doubt thread is memory: the student can refer back to any earlier
  // explanation. Long threads are summarised instead of growing without limit.
  const reply = await converse({
    Model: DoubtClearance,
    filter: { _id: doubt._id, userId },
    field: 'chatHistory',
    timeKey: 'timestamp',
    system,
    input: question,
    tier: 'REASONING',
    temperature: 0.5,
  });
  await DoubtClearance.updateOne({ _id: doubt._id }, { $set: { updatedAt: new Date() } });
  return reply;
}

const transcriptOf = (chatHistory, separator = '\n') => chatHistory.map((m) => `${m.role}: ${m.content}`).join(separator);

async function summarizeDoubt({ userId, doubtId }) {
  const doubt = await findOwnDoubt(userId, doubtId, 'title description chatHistory summary');
  if (doubt.summary) return doubt.summary;
  // The whole thread is read: a long one is condensed part by part until it fits one request.
  const thread = await condenseToFit(transcriptOf(doubt.chatHistory), { what: 'tutoring conversation' });

  const summary = await complete({
    messages: [
      {
        role: 'system',
        content: `You are an educational assistant that creates comprehensive notes of doubt clearance sessions.
          Create a clear, structured summary of the doubt and the discussion that followed.
          Include:
          1. The original doubt/problem
          2. Key points discussed
          3. Main solutions or explanations provided
          4. Important takeaways

          Make it educational and easy to understand.

${MARKDOWN_WITH_FLOWCHART}`,
      },
      {
        role: 'user',
        content: `Doubt Title: "${doubt.title}"
          Doubt Description: "${doubt.description}"

          ${thread.condensed ? 'Detailed notes on each consecutive part of the chat, in order' : 'Chat History'}:
          ${thread.text}

          Please create a comprehensive summary of this doubt clearance session.`,
      },
    ],
    model: MODELS.REASONING,
    temperature: 0.5,
  });
  if (!summary) throw upstreamError('The summary could not be generated. Please try again.');

  await DoubtClearance.updateOne({ _id: doubt._id }, { $set: { summary, updatedAt: new Date() } });
  return summary;
}

async function generateDoubtQuiz({ userId, doubtId, body }) {
  const doubt = await findOwnDoubt(userId, doubtId, 'title description chatHistory');
  if (doubt.chatHistory.length < MIN_MESSAGES_FOR_EXTRAS) {
    throw badRequest('Not enough chat history to generate a quiz. Please have at least 4 conversations first.');
  }

  const options = readQuizOptions(body);
  const conversation = doubt.chatHistory
    .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n\n');

  const questions = await generateQuiz({
    subject: doubt.title,
    content: sampleContent(
      `Doubt: ${doubt.title}\nDetails: ${doubt.description}\n\n` +
      `Conversation (test what was explained here):\n${conversation}`
    ),
    options,
    model: MODELS.REASONING,
  });

  const updated = await DoubtClearance.findOneAndUpdate(
    { _id: doubt._id },
    {
      $push: { quizzes: { questions, score: null, totalQuestions: questions.length, settings: options, completedAt: new Date() } },
      $set: { updatedAt: new Date() },
    },
    { new: true, projection: { 'quizzes._id': 1 } }
  ).lean();
  return { quiz: questions, quizIndex: updated.quizzes.length - 1, settings: options };
}

async function saveDoubtQuizResult({ userId, doubtId, quizIndex, score }) {
  if (quizIndex === undefined || score === undefined) {
    throw badRequest('Doubt ID, quiz index, score, and userId are required');
  }
  const doubt = await findOwnDoubt(userId, doubtId, 'quizzes.totalQuestions quizzes.questions');
  const index = integer(quizIndex, 'Quiz index', { min: 0, max: doubt.quizzes.length - 1 });
  const total = doubt.quizzes[index].totalQuestions || doubt.quizzes[index].questions.length;
  const correct = integer(score, 'Score', { min: 0, max: total });

  const now = new Date();
  await DoubtClearance.updateOne(
    { _id: doubt._id },
    { $set: { [`quizzes.${index}.score`]: correct, [`quizzes.${index}.completedAt`]: now, [`quizzes.${index}.attemptedAt`]: now, updatedAt: now } }
  );
}

// ── video recommendations ──────────────────────────────────────────────────

async function searchYouTube(query, maxResults) {
  try {
    await gateway.assertYoutubeEnabled('search');
    const results = await gateway.track({ gateway: 'youtube', operation: 'search' }, () => youtubeSearch.GetListByKeyword(query, false, maxResults, [{ type: 'video' }]));
    return (results.items || [])
      .slice(0, maxResults)
      .filter((video) => video.type === 'video' && video.id)
      .map((video) => ({
        title: video.title || 'No title',
        description: video.description || 'No description',
        thumbnail: video.thumbnail?.thumbnails?.[video.thumbnail.thumbnails.length - 1]?.url || `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`, // hqdefault always exists; maxresdefault often does not
        url: `https://www.youtube.com/watch?v=${video.id}`,
        duration: video.length?.text || 'Unknown',
        reason: `Found using keywords: ${query}`,
      }));
  } catch (error) {
    logger.warn('YouTube search failed', { query, error: error.message });
    return [];
  }
}

/** Single keywords, then pairs and triples, then "tutorial"/"explanation" variants - most specific to the chat first. */
function searchQueriesFor(keywords) {
  const k = keywords;
  const queries = [...k.slice(0, 4)];
  if (k.length >= 2) queries.push(`${k[0]} ${k[1]}`);
  if (k.length >= 3) queries.push(`${k[1]} ${k[2]}`);
  if (k.length >= 4) queries.push(`${k[2]} ${k[3]}`);
  if (k.length >= 3) queries.push(`${k[0]} ${k[1]} ${k[2]}`);
  if (k.length >= 4) queries.push(`${k[1]} ${k[2]} ${k[3]}`);
  if (k.length >= 2) queries.push(`${k[0]} tutorial`, `${k[1]} explanation`);
  return queries;
}

async function recommendVideosForDoubt({ userId, doubtId }) {
  const doubt = await findOwnDoubt(userId, doubtId, 'title description chatHistory');
  if (doubt.chatHistory.length < MIN_MESSAGES_FOR_EXTRAS) {
    throw badRequest('Not enough chat history to generate recommendations. Please have at least 4 conversations first.');
  }

  // Keywords come mainly from what was actually discussed in the chat.
  const reply = await complete({
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant that generates educational keywords for YouTube searches based on doubt clearance chat conversations.

          Focus PRIMARILY on the chat history content - what was actually discussed, explained, and learned during the conversation.
          The initial doubt is just context, but the chat history contains the real educational content.

          Return your response as a JSON array with keywords:
          ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7"]

          Extract keywords from:
          - Specific concepts mentioned in the chat
          - Technical terms discussed
          - Examples given during the conversation
          - Solutions or explanations provided
          - Topics that were explored in detail
          - Educational content that was shared

          Make keywords specific, educational, and searchable on YouTube. Prioritize content from the actual conversation over the initial doubt.`,
      },
      {
        role: 'user',
        content: `Initial Doubt: "${doubt.title}" - ${doubt.description}

          Chat Conversation:
          ${sampleContent(transcriptOf(doubt.chatHistory, '\n\n'))}

          Based on the actual conversation above, extract 6-7 educational keywords that would help find relevant YouTube videos for the topics discussed in the chat.`,
      },
    ],
    model: MODELS.REASONING,
    temperature: 0.7,
  });

  let keywords = [];
  try {
    const parsed = parseModelJson(reply, { context: 'search keywords' });
    keywords = (Array.isArray(parsed) ? parsed : [])
      .filter((k) => typeof k === 'string' && k.trim())
      .map((k) => k.trim().slice(0, 80))
      .slice(0, 7);
  } catch (error) {
    logger.warn('Could not parse search keywords', { error: error.message });
  }
  if (!keywords.length) keywords = [doubt.title];

  // Two videos per query, a few searches at a time, results kept in query order.
  const batches = await mapWithConcurrency(searchQueriesFor(keywords), 4, (query) => searchYouTube(query, 2));
  const seen = new Set();
  const recommendations = batches.flat().filter((video) => (seen.has(video.url) ? false : seen.add(video.url))).slice(0, 6);

  if (recommendations.length === 0) {
    return {
      recommendations: [],
      message: 'No relevant videos found. Try having more conversations about your doubt to get better recommendations.',
    };
  }

  const suggestedAt = new Date();
  await DoubtClearance.updateOne(
    { _id: doubt._id },
    { $set: { youtubeRecommendations: recommendations.map((rec) => ({ ...rec, suggestedAt })), updatedAt: suggestedAt } }
  );
  return { recommendations };
}

module.exports = {
  createDoubt,
  listDoubts,
  deleteDoubt,
  chatWithDoubt,
  summarizeDoubt,
  generateDoubtQuiz,
  saveDoubtQuizResult,
  recommendVideosForDoubt,
  _internal: { searchQueriesFor },
};
