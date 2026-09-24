require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const mongoose = require('mongoose');
const connectDB = require('./connect');
const { saveUser, getUserByEmail, getUserProfile, updateUserProfile } = require('./controllers/userController');
const { processSkillsPrompt, getSkillsByCareer } = require('./controllers/skillsController');  
const { processProjectPrompt, getProjectsByCareer } = require('./controllers/projectsController');  
const { getCareerIds } = require('./controllers/skillsController');
const { deleteSkillsByCareer } = require('./controllers/skillsController');
const {getProjectCareerIds} = require('./controllers/projectsController'); 
const {deleteProjectsByCareer} = require('./controllers/projectsController'); 
const { processResumePrompt, getResumeByCareer, getResumeCareerIds, deleteResumeByCareer } = require('./controllers/resumeController');
const { processChatbotPrompt, listConversations, getConversation, deleteConversation } = require('./controllers/chatbot');
const { 
  upload, 
  uploadNotes, 
  chatWithNotes, 
  summarizeNotes, 
  generateQuiz, 
  getUserNotes,
  deleteNote,
  saveQuizResults
} = require('./controllers/notesController');
const { 
  getUserVideoRequests, 
  createVideoRequest, 
  deleteVideoRequest, 
  recommendVideos 
} = require('./controllers/videosController');
const { 
  upload: uploadVideoMiddleware,
  uploadVideo,
  createYouTubeVideo,
  getUserYouTubeVideos,
  chatWithYouTubeVideo,
  summarizeYouTubeVideo,
  generateQuizForYouTubeVideo,
  saveQuizResults: saveYouTubeQuizResults,
  searchYouTubeVideos,
  deleteYouTubeVideo
} = require('./controllers/youtubeVideoController');
const {
  createEducationalVideo,
  getUserEducationalVideos,
  chatWithEducationalVideo,
  summarizeEducationalVideo,
  generateEducationalQuiz,
  saveEducationalQuizResults,
  deleteEducationalVideo
} = require('./controllers/educationalVideoController');
const {
  getUserDoubtClearances,
  createDoubtClearance,
  deleteDoubtClearance,
  chatWithDoubtClearance,
  summarizeDoubtClearance,
  generateDoubtQuiz,
  saveDoubtQuizResults,
  getYouTubeRecommendations
} = require('./controllers/doubtClearanceController');
const {
  createIssue,
  getAllIssues,
  getIssueById,
  getIssueComments,
  addComment,
  updateIssueStatus,
  deleteIssue,
  voteOnIssue,
  voteOnComment,
  searchIssues,
  generateAIResponseForComment
} = require('./controllers/forumController');
const {
  generateAIForumResponse
} = require('./controllers/forumAIController');
const {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  addVideoToCourse,
  updateVideoInCourse,
  deleteVideoFromCourse
} = require('./controllers/courseController');
const {
  generateQuizForVideo,
  getVideoQuiz,
  submitQuizAnswers,
  getQuizResults
} = require('./controllers/quizController');
const {
  generatePlan,
  generateQuiz: generateSkillQuiz,
  getUserPlans,
  saveQuizResult,
  toggleDayCompletion,
  deletePlan,
  refreshVideo
} = require('./controllers/skillUnlockerController');
const {
  getUserAnalytics
} = require('./controllers/analyticsController');
const { getQuizHistory } = require('./controllers/quizHistoryController');
const roadmaps = require('./controllers/roadmapController');
const skillGap = require('./controllers/skillGapController');



const REQUIRED_ENV = ['MONGO_URI', 'GROQ_API_KEY'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(
    `\nMissing required environment variable(s): ${missingEnv.join(', ')}\n` +
    `Add them to server/.env before starting the server.\n`
  );
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
  console.warn(
    'Neither GEMINI_API_KEY nor GOOGLE_API_KEY is set - Udemy/Coursera/edureka course discovery will return no results.'
  );
}

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

connectDB();

app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));
app.get('/', (req, res) => res.status(200).send('NOVARD-AI API is running'));

app.post('/saveUser', saveUser); 
app.get('/getUser/:email', getUserByEmail);
app.get('/getUserProfile', getUserProfile);
app.post('/updateUserProfile', updateUserProfile);  

app.get('/api/careerIds', getCareerIds);
app.get('/api/projects/careerIds', getProjectCareerIds);

app.post('/api/skills', processSkillsPrompt);  
app.get('/api/skills/:careerId', getSkillsByCareer);  
app.delete('/api/skills/delete/:careerId', deleteSkillsByCareer);

app.post('/api/projects/process', processProjectPrompt); 
app.get('/api/projects/:careerId', getProjectsByCareer);  
app.delete('/api/projects/delete/:careerId', deleteProjectsByCareer);


app.post('/api/resumes/process', processResumePrompt);
app.get('/api/resumes/:careerId', getResumeByCareer);
app.get('/api/resumes/career/careerIds', getResumeCareerIds);
app.delete('/api/resumes/delete/:careerId', deleteResumeByCareer);

app.post('/api/chatbot', processChatbotPrompt);
app.get('/api/chatbot/conversations/user/:userId', listConversations);
app.get('/api/chatbot/conversations/:id', getConversation);
app.delete('/api/chatbot/conversations/:id', deleteConversation);

// Notes routes
app.post('/upload-notes', upload.single('pdf'), uploadNotes);
app.post('/chat-with-notes', chatWithNotes);
app.post('/summarize-notes', summarizeNotes);
app.post('/generate-quiz', generateQuiz);
app.get('/notes/:userId', getUserNotes);
app.delete('/notes/:noteId', deleteNote);
app.post('/save-quiz-results', saveQuizResults);

// Video requests routes
app.get('/video-requests/:userId', getUserVideoRequests);
app.post('/video-requests', createVideoRequest);
app.delete('/video-requests/:videoRequestId', deleteVideoRequest);
app.post('/recommend-videos', recommendVideos);

// Educational video requests routes
app.get('/educational-video-requests/:userId', getUserVideoRequests);
app.post('/educational-video-requests', createVideoRequest);
app.delete('/educational-video-requests/:videoRequestId', deleteVideoRequest);
app.post('/recommend-educational-videos', recommendVideos);

// YouTube Video Summarizer routes
app.post('/youtube-videos', createYouTubeVideo);
app.post('/upload-video', uploadVideoMiddleware.single('video'), uploadVideo);
app.get('/youtube-videos/:userId', getUserYouTubeVideos);
app.post('/chat-with-youtube-video', chatWithYouTubeVideo);
app.post('/summarize-youtube-video', summarizeYouTubeVideo);
app.post('/generate-youtube-quiz', generateQuizForYouTubeVideo);
app.post('/save-youtube-quiz-results', saveYouTubeQuizResults);
app.post('/youtube/search', searchYouTubeVideos);
app.delete('/youtube-videos/:videoId', deleteYouTubeVideo);

// Educational Video Summarizer routes
app.post('/educational-videos', createEducationalVideo);
app.get('/educational-videos/:userId', getUserEducationalVideos);
app.post('/chat-with-educational-video', chatWithEducationalVideo);
app.post('/summarize-educational-video', summarizeEducationalVideo);
app.post('/generate-educational-quiz', generateEducationalQuiz);
app.post('/save-educational-quiz-results', saveEducationalQuizResults);
app.delete('/educational-videos/:videoId', deleteEducationalVideo);

// Doubt Clearance routes
app.get('/doubt-clearances/:userId', getUserDoubtClearances);
app.post('/doubt-clearances', createDoubtClearance);
app.delete('/doubt-clearances/:doubtId', deleteDoubtClearance);
app.post('/chat-with-doubt-clearance', chatWithDoubtClearance);
app.post('/summarize-doubt-clearance', summarizeDoubtClearance);
app.post('/generate-doubt-quiz', generateDoubtQuiz);
app.post('/save-doubt-quiz-results', saveDoubtQuizResults);
app.post('/get-youtube-recommendations', getYouTubeRecommendations);

// Forum routes
app.post('/api/forum/issues', createIssue);
app.get('/api/forum/issues', getAllIssues);
app.get('/api/forum/issues/:issueId', getIssueById);
app.get('/api/forum/issues/:issueId/comments', getIssueComments);
app.post('/api/forum/comments', addComment);
app.put('/api/forum/issues/:issueId/status', updateIssueStatus);
app.delete('/api/forum/issues/:issueId', deleteIssue);
app.post('/api/forum/issues/:issueId/vote', voteOnIssue);
app.post('/api/forum/comments/:commentId/vote', voteOnComment);
app.get('/api/forum/search', searchIssues);
app.post('/api/forum/comments/:commentId/ai-response', generateAIResponseForComment);
app.post('/api/forum/ai-response', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    const response = await generateAIForumResponse(prompt);
    res.json({ response });
  } catch (error) {
    console.error('Error generating AI response:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

// Course routes
app.get('/api/courses', getAllCourses);
app.get('/api/courses/:courseId', getCourseById);
app.post('/api/courses', createCourse);
app.put('/api/courses/:courseId', updateCourse);
app.delete('/api/courses/:courseId', deleteCourse);
app.post('/api/courses/:courseId/videos', addVideoToCourse);
app.put('/api/courses/:courseId/videos/:videoId', updateVideoInCourse);
app.delete('/api/courses/:courseId/videos/:videoId', deleteVideoFromCourse);

// Quiz routes
app.post('/api/courses/:courseId/videos/:videoId/generate-quiz', generateQuizForVideo);
app.get('/api/courses/:courseId/videos/:videoId/quiz', getVideoQuiz);
app.post('/api/courses/:courseId/videos/:videoId/quiz/submit', submitQuizAnswers);
app.get('/api/courses/:courseId/videos/:videoId/quiz/results', getQuizResults);

// Skill Unlocker routes
app.post('/api/skill-unlocker/generate-plan', generatePlan);
app.post('/api/skill-unlocker/generate-quiz', generateSkillQuiz);
app.get('/api/skill-unlocker/plans/:userId', getUserPlans);
app.post('/api/skill-unlocker/save-quiz-result', saveQuizResult);
app.post('/api/skill-unlocker/toggle-day-completion', toggleDayCompletion);
app.delete('/api/skill-unlocker/plans/:planId', deletePlan);
app.post('/api/skill-unlocker/refresh-video', refreshVideo);

// Analytics routes
app.get('/api/analytics/:userId', getUserAnalytics);

// Previous quiz marks for one note / video / doubt / learning plan
app.get('/api/quiz-history/:source/:itemId', getQuizHistory);

// AI-generated personalised career roadmaps
app.post('/api/roadmaps/generate', roadmaps.generate);
app.get('/api/roadmaps/user/:userId', roadmaps.listForUser);
app.get('/api/roadmaps/:id', roadmaps.getOne);
app.delete('/api/roadmaps/:id', roadmaps.remove);

// Skill-gap coach: analyse a profile, then chat about it
app.post('/api/skill-gap/sessions', skillGap.createSession);
app.get('/api/skill-gap/sessions/user/:userId', skillGap.listSessions);
app.get('/api/skill-gap/sessions/:id', skillGap.getSession);
app.post('/api/skill-gap/sessions/:id/messages', skillGap.sendMessage);
app.delete('/api/skill-gap/sessions/:id', skillGap.deleteSession);

// ── Unmatched routes ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// ── Central error handler ─────────────────────────────────────────────────
// Without this, Express replies to upload failures and thrown errors with an
// HTML stack trace, which the client's response.json() then chokes on.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error('Unhandled error:', err);

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large.'
        : `Upload failed: ${err.message}`;
    return res.status(413).json({ error: message });
  }

  if (err && /Only (PDF|video) files are allowed/i.test(err.message || '')) {
    return res.status(415).json({ error: err.message });
  }

  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }

  return res.status(err.status || 500).json({
    error: err.expose ? err.message : 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT in server/.env.`);
    process.exit(1);
  }
  throw err;
});

// Keep the process alive on a stray rejection rather than dying mid-request,
// but make it loud so the cause is visible in the log.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

const shutdown = (signal) => () => {
  console.log(`\n${signal} received - shutting down.`);
  server.close(() => {
    mongoose.connection.close(false).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGINT', shutdown('SIGINT'));
process.on('SIGTERM', shutdown('SIGTERM'));
