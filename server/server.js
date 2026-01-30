const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./connect');
const { saveUser, getUserByEmail, getUserProfile, updateUserProfile } = require('./controllers/userController');
const { processSkillsPrompt, getSkillsByCareer } = require('./controllers/skillsController');  
const { processProjectPrompt, getProjectsByCareer } = require('./controllers/projectsController');  
const { getCareerIds } = require('./controllers/skillsController');
const { deleteSkillsByCareer } = require('./controllers/skillsController');
const {getProjectCareerIds} = require('./controllers/projectsController'); 
const {deleteProjectsByCareer} = require('./controllers/projectsController'); 
const { processResumePrompt, getResumeByCareer, getResumeCareerIds, deleteResumeByCareer } = require('./controllers/resumeController');
const { processChatbotPrompt } = require('./controllers/chatbot');
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


const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

connectDB();

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
app.post('/api/skill-unlocker/toggle-day-completion', toggleDayCompletion);
app.delete('/api/skill-unlocker/plans/:planId', deletePlan);
app.post('/api/skill-unlocker/refresh-video', refreshVideo);

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
