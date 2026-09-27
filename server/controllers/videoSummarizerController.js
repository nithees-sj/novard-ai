const videos = require('../services/videoSummarizerService');
const { currentUserId } = require('../middleware/auth');
const { badRequest } = require('../utils/httpError');

exports.create = async (req, res) => {
  const { title, videoUrl } = req.body;
  if (!title) throw badRequest('Title, video URL, and user ID are required');
  const video = await videos.addYouTubeVideo({ title, videoUrl, userId: currentUserId(req, req.body.userId) });
  res.status(201).json(videos.presentVideo(video));
};

exports.list = async (req, res) => {
  res.json(await videos.listVideos(currentUserId(req, req.params.userId)));
};

exports.chat = async (req, res) => {
  const { videoId, message } = req.body;
  res.json({ response: await videos.chatWithVideo({ userId: currentUserId(req, req.body.userId), videoId, message }) });
};

exports.summarize = async (req, res) => {
  res.json({ summary: await videos.summarizeVideo({ userId: currentUserId(req, req.body.userId), videoId: req.body.videoId }) });
};

exports.generateQuiz = async (req, res) => {
  res.json(await videos.generateVideoQuiz({ userId: currentUserId(req, req.body.userId), videoId: req.body.videoId, body: req.body }));
};

exports.saveQuizResults = async (req, res) => {
  const { videoId, quizIndex, score } = req.body;
  await videos.saveVideoQuizResult({ userId: currentUserId(req, req.body.userId), videoId, quizIndex, score });
  res.json({ success: true });
};

exports.remove = async (req, res) => {
  await videos.deleteVideo({ userId: currentUserId(req, req.body?.userId), videoId: req.params.videoId });
  res.json({ success: true });
};
