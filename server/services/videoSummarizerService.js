const YouTubeVideo = require('../models/youtubeVideo');
const { MODELS } = require('../config/ai');
const { MARKDOWN_WITH_FLOWCHART } = require('../config/prompts');
const { complete } = require('../ai/groqClient');
const { converse } = require('../ai/conversation');
const { videoTutorPrompt } = require('../ai/prompts');
const { readQuizOptions, generateQuiz, sampleContent } = require('./quizService');
const { extractVideoId, fetchVideoDetails } = require('./youtubeService');
const { removeUpload } = require('../utils/uploads');
const { badRequest, notFound } = require('../utils/httpError');
const { objectId, text, integer } = require('../utils/validate');

/** Video Summarizer: YouTube videos in a student's library, with chat, summary and quizzes. */

// Internal fields never sent to the browser (the transcript can be 200 kB; videoPath is a server path).
const HIDDEN_FIELDS = '-transcript -memory -videoPath';

async function listVideos(userId) {
  return YouTubeVideo.find({ userId }).sort({ createdAt: -1 }).select(HIDDEN_FIELDS).lean();
}

async function findOwnVideo(userId, videoId, select) {
  const query = YouTubeVideo.findOne({ _id: objectId(videoId, 'video id'), userId });
  if (select) query.select(select);
  const video = await query;
  if (!video) throw notFound('Video not found');
  return video;
}

const presentVideo = (doc) => {
  const { transcript, memory, videoPath, ...rest } = doc.toObject ? doc.toObject() : doc; // eslint-disable-line no-unused-vars
  return rest;
};

/**
 * Add a YouTube video to a student's library (info + transcript).
 * Shared by the Video Summarizer page and the Novard Agent. With
 * `returnExisting`, a video already in the library is returned instead of rejected.
 */
async function addYouTubeVideo({ title, videoUrl, userId }, { returnExisting = false } = {}) {
  if (!videoUrl || !userId) throw badRequest('Video URL and user ID are required');
  const videoId = extractVideoId(videoUrl);
  if (!videoId) throw badRequest('Invalid YouTube URL');
  const cleanTitle = text(title, 'Title', { required: false, max: 200 });

  const existing = await YouTubeVideo.findOne({ videoId, userId });
  if (existing) {
    if (returnExisting) return existing;
    throw badRequest('This video has already been added');
  }

  const details = await fetchVideoDetails(videoId);
  return YouTubeVideo.create({
    title: cleanTitle || details.title,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
    description: details.description,
    transcript: details.transcript,
    userId,
    videoType: 'youtube',
  });
}

async function chatWithVideo({ userId, videoId, message }) {
  const question = text(message, 'Message', { max: 4000, collapse: false });
  const video = await findOwnVideo(userId, videoId, 'title description summary transcript');

  const reply = await converse({
    Model: YouTubeVideo,
    filter: { _id: video._id, userId },
    field: 'chatHistory',
    timeKey: 'timestamp',
    system: videoTutorPrompt(video),
    input: question,
    tier: 'FAST',
    maxTokens: 2500,
    temperature: 0.5,
  });
  await YouTubeVideo.updateOne({ _id: video._id }, { $set: { updatedAt: new Date() } });
  return reply;
}

async function summarizeVideo({ userId, videoId }) {
  const video = await findOwnVideo(userId, videoId, 'title description summary transcript');
  if (video.summary) return video.summary;

  const summary = await complete({
    messages: [
      {
        role: 'system',
        content: `You are an expert at creating comprehensive summaries of YouTube videos. Create a detailed summary that covers the main topics, key points, and important insights from the video.

IMPORTANT - Format your summary using these markdown elements for professional display:

1. Use ### for section headers (e.g., "### Main Topics", "### Key Insights")
2. Use numbered lists (1. 2. 3.) for sequential points
3. Use bullet points (- or *) for key points or features
4. Use code blocks with language tags if there are code examples in the video:
   \`\`\`language
   // code here
   \`\`\`
5. Use emoji indicators for special notes:
   ℹ️ for informational content
   💡 for helpful tips or insights
   ⚠️ for warnings or important caveats
   ✅ for best practices or conclusions

SUMMARY STRUCTURE:
- Start with a brief introduction
- Use ### headers to organize main sections (e.g., "### Overview", "### Main Topics", "### Key Takeaways")
- Use numbered or bullet lists for organized content
- Add emoji-prefixed notes for emphasis
- End with a conclusion or key takeaways section
- If transcript is not available, work with the title and description to create the best possible summary

${MARKDOWN_WITH_FLOWCHART}`,
      },
      {
        role: 'user',
        // Long transcripts are sampled from start to end so they fit the model's context.
        content: `Please create a comprehensive summary of this YouTube video:\n\nTitle: ${video.title}\nDescription: ${video.description}\nContent: ${sampleContent(video.transcript)}\n\nProvide a well-structured summary with main topics, key points, and important insights.`,
      },
    ],
    model: MODELS.FAST,
    temperature: 0.7,
    maxTokens: 3200,
  }) || 'Unable to generate summary.';

  await YouTubeVideo.updateOne({ _id: video._id }, { $set: { summary, updatedAt: new Date() } });
  return summary;
}

async function generateVideoQuiz({ userId, videoId, body }) {
  const video = await findOwnVideo(userId, videoId, 'title description summary transcript');
  const options = readQuizOptions(body);
  const questions = await generateQuiz({
    subject: video.title,
    content: sampleContent(
      `Title: ${video.title}\nDescription: ${video.description || ''}\n` +
      `Summary: ${video.summary || ''}\nTranscript: ${video.transcript || ''}`
    ),
    options,
    model: MODELS.REASONING,
  });

  // $push, not save(): a whole-document save re-validates every older quiz too.
  const updated = await YouTubeVideo.findOneAndUpdate(
    { _id: video._id },
    { $push: { quizzes: { questions, totalQuestions: questions.length, settings: options } }, $set: { updatedAt: new Date() } },
    { new: true, projection: { 'quizzes._id': 1 } }
  ).lean();
  return { quiz: questions, quizIndex: updated.quizzes.length - 1, settings: options };
}

async function saveVideoQuizResult({ userId, videoId, quizIndex, score }) {
  if (quizIndex === undefined || score === undefined) {
    throw badRequest('Video ID, quiz index, score, and user ID are required');
  }
  const video = await findOwnVideo(userId, videoId, 'quizzes.totalQuestions quizzes.questions');
  const index = integer(quizIndex, 'Quiz index', { min: 0, max: video.quizzes.length - 1 });
  const total = video.quizzes[index].totalQuestions || video.quizzes[index].questions.length;
  const correct = integer(score, 'Score', { min: 0, max: total });

  const now = new Date();
  await YouTubeVideo.updateOne(
    { _id: video._id },
    { $set: { [`quizzes.${index}.score`]: correct, [`quizzes.${index}.completedAt`]: now, [`quizzes.${index}.attemptedAt`]: now } }
  );
}

async function deleteVideo({ userId, videoId }) {
  const video = await YouTubeVideo.findOneAndDelete({ _id: objectId(videoId, 'video id'), userId }).select('videoType videoPath').lean();
  if (!video) throw notFound('Video not found');
  // Videos uploaded by the old upload feature also have a file on disk.
  if (video.videoType === 'uploaded') await removeUpload(video.videoPath);
}

module.exports = {
  addYouTubeVideo,
  listVideos,
  presentVideo,
  chatWithVideo,
  summarizeVideo,
  generateVideoQuiz,
  saveVideoQuizResult,
  deleteVideo,
};
