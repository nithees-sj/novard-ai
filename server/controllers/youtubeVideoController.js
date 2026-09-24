const YouTubeVideo = require('../models/youtubeVideo');
const Groq = require('groq-sdk');
const { Innertube } = require('youtubei.js');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');
const { parseModelJson } = require('../utils/parseModelJson');
const { MARKDOWN_WITH_FLOWCHART } = require('../config/prompts');
const { readQuizOptions, generateQuiz: generateQuizQuestions, sampleContent } = require('../services/quizService');
const { converse } = require('../ai/conversation');
const { videoTutorPrompt } = require('../ai/prompts');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `video-${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// Helper function to extract video ID from YouTube URL
const extractVideoId = (url) => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

// Helper function to get video title and description from YouTube
const getVideoInfo = async (videoId) => {
  try {
    const yt = await Innertube.create();
    const info = await yt.getInfo(videoId);
    
    return {
      title: info.basic_info.title || `YouTube Video ${videoId}`,
      description: info.basic_info.short_description || info.basic_info.description || 'No description available'
    };
  } catch (error) {
    console.error('Error fetching video info:', error);
    return {
      title: `YouTube Video ${videoId}`,
      description: 'Unable to fetch video details'
    };
  }
};

// Helper function to get video transcript
const getVideoTranscript = async (videoId) => {
  try {
    const yt = await Innertube.create();
    const info = await yt.getInfo(videoId);
    
    // Try to get captions/transcript
    if (info.captions && info.captions.caption_tracks && info.captions.caption_tracks.length > 0) {
      const captionTrack = info.captions.caption_tracks[0];
      const transcript = await yt.getTranscript(videoId, { lang: captionTrack.language_code });
      
      if (transcript && transcript.content) {
        // Extract text from transcript segments
        const transcriptText = transcript.content.body.map(segment => segment.text).join(' ');
        return transcriptText;
      }
    }
    
    // Fallback: return a message about transcript availability
    return `Transcript not available for this video. The video title is: "${info.basic_info.title || 'Unknown'}" and description: "${info.basic_info.short_description || info.basic_info.description || 'No description available'}". You can still ask questions about the video based on its title and description.`;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return `Unable to fetch video transcript. You can still ask questions about the video based on its title and description.`;
  }
};

// Helper function to generate content for uploaded video using Groq
const generateVideoContent = async (originalFileName = 'uploaded video') => {
  try {
    console.log('Generating content for uploaded video using Groq...');
    
    // Generate educational content using Groq based on the video file name
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates educational content summaries. Based on the video filename provided, create a realistic transcript-like content that would be appropriate for that type of video. Make it educational and informative, covering the main topics that would typically be discussed in such a video."
        },
        {
          role: "user",
          content: `Based on this video filename: "${originalFileName}", create a realistic educational transcript. The video appears to be about: ${originalFileName.replace(/[^a-zA-Z0-9\s]/g, ' ').trim()}. Please create a comprehensive transcript that covers the main topics that would typically be discussed in such a video. Make it detailed and educational.`
        }
      ],
      model: MODELS.FAST,
      ...GROQ_DEFAULTS,
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    const content = completion.choices[0]?.message?.content || `Educational content based on: ${originalFileName}`;
    console.log('Content generated successfully');
    return content;
  } catch (error) {
    console.error('Error generating content with Groq:', error);
    // Return a fallback content
    return `This is educational content for the uploaded video: "${originalFileName}". The video has been uploaded successfully. You can ask questions about the video content, and I'll do my best to help based on the video title and any context you provide.`;
  }
};

// Upload and process video file
const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const { title, userId } = req.body;
    
    if (!title || !userId) {
      // Clean up uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Title and user ID are required' });
    }

    console.log('Processing uploaded video:', req.file.originalname);
    console.log('File size:', req.file.size, 'bytes');
    console.log('File type:', req.file.mimetype);

    // Generate content for uploaded video using Groq
    const transcript = await generateVideoContent(req.file.originalname);
    
    console.log('Successfully processed uploaded video');

    const youtubeVideo = new YouTubeVideo({
      title,
      videoUrl: `/uploads/videos/${req.file.filename}`,
      videoId: req.file.filename, // Use filename as unique ID for uploaded videos
      description: 'Uploaded video',
      transcript,
      userId,
      videoType: 'uploaded',
      videoPath: req.file.path,
      originalFileName: req.file.originalname,
      fileSize: req.file.size
    });

    await youtubeVideo.save();
    console.log('Video saved to database successfully');
    res.status(201).json(youtubeVideo);
  } catch (error) {
    console.error('Error processing uploaded video:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Error processing uploaded video: ' + error.message });
  }
};

// Create new YouTube video entry
const createYouTubeVideo = async (req, res) => {
  try {
    const { title, videoUrl, userId } = req.body;
    
    if (!title || !videoUrl || !userId) {
      return res.status(400).json({ error: 'Title, video URL, and user ID are required' });
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Check if video already exists for this user
    const existingVideo = await YouTubeVideo.findOne({ 
      videoId: videoId, 
      userId: userId 
    });
    
    if (existingVideo) {
      return res.status(400).json({ error: 'This video has already been added' });
    }

    // Get video info and transcript
    const videoInfo = await getVideoInfo(videoId);
    const transcript = await getVideoTranscript(videoId);
    
    console.log('Video Info:', videoInfo);
    console.log('Transcript length:', transcript.length);

    const youtubeVideo = new YouTubeVideo({
      title: title || videoInfo.title,
      videoUrl,
      videoId,
      description: videoInfo.description,
      transcript,
      userId,
      videoType: 'youtube'
    });

    await youtubeVideo.save();
    res.status(201).json(youtubeVideo);
  } catch (error) {
    console.error('Error creating YouTube video:', error);
    res.status(500).json({ error: 'Error creating YouTube video' });
  }
};

// Get user's YouTube videos
const getUserYouTubeVideos = async (req, res) => {
  try {
    const { userId } = req.params;
    const videos = await YouTubeVideo.find({ userId }).sort({ createdAt: -1 });
    res.json(videos);
  } catch (error) {
    console.error('Error getting user YouTube videos:', error);
    res.status(500).json({ error: 'Error getting YouTube videos' });
  }
};

// Chat with YouTube video
const chatWithYouTubeVideo = async (req, res) => {
  try {
    const { videoId, message, userId } = req.body;
    const question = String(message || '').trim();
    if (!videoId || !question || !userId) {
      return res.status(400).json({ error: 'Video ID, message, and user ID are required' });
    }

    const video = await YouTubeVideo.findOne({ _id: videoId, userId }).select('title description summary transcript');
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Previously the model saw only the latest question, so follow-ups like
    // "explain the second point again" had nothing to refer to.
    const aiResponse = await converse({
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

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error chatting with YouTube video:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error processing chat message' });
  }
};

// Summarize YouTube video
const summarizeYouTubeVideo = async (req, res) => {
  try {
    const { videoId, userId } = req.body;
    
    if (!videoId || !userId) {
      return res.status(400).json({ error: 'Video ID and user ID are required' });
    }

    const video = await YouTubeVideo.findOne({ _id: videoId, userId });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // If summary already exists, return it
    if (video.summary) {
      return res.json({ summary: video.summary });
    }

    // Generate summary using Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
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

${MARKDOWN_WITH_FLOWCHART}`
        },
        {
          role: "user",
          content: `Please create a comprehensive summary of this YouTube video:\n\nTitle: ${video.title}\nDescription: ${video.description}\nContent: ${video.transcript}\n\nProvide a well-structured summary with main topics, key points, and important insights.`
        }
      ],
      model: MODELS.FAST,
      ...GROQ_DEFAULTS,
      temperature: 0.7,
      max_tokens: 3200,
    });

    const summary = completion.choices[0]?.message?.content || 'Unable to generate summary.';

    // Save summary to video
    video.summary = summary;
    await video.save();

    res.json({ summary });
  } catch (error) {
    console.error('Error summarizing YouTube video:', error);
    res.status(500).json({ error: 'Error generating summary' });
  }
};

// Generate quiz for YouTube video
const generateQuizForYouTubeVideo = async (req, res) => {
  try {
    const { videoId, userId } = req.body;
    if (!videoId || !userId) {
      return res.status(400).json({ error: 'Video ID and user ID are required' });
    }

    const video = await YouTubeVideo.findOne({ _id: videoId, userId });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const options = readQuizOptions(req.body);
    const questions = await generateQuizQuestions({
      subject: video.title,
      content: sampleContent(
        `Title: ${video.title}\nDescription: ${video.description || ''}\n` +
        `Summary: ${video.summary || ''}\nTranscript: ${video.transcript || ''}`
      ),
      options,
      model: MODELS.REASONING,
    });

    video.quizzes.push({ questions, totalQuestions: questions.length, settings: options });
    await video.save();
    res.json({ quiz: questions, quizIndex: video.quizzes.length - 1, settings: options });
  } catch (error) {
    console.error('Error generating quiz for YouTube video:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error generating quiz' });
  }
};

// Save quiz results
const saveQuizResults = async (req, res) => {
  try {
    const { videoId, quizIndex, score, userId } = req.body;
    
    if (!videoId || quizIndex === undefined || score === undefined || !userId) {
      return res.status(400).json({ error: 'Video ID, quiz index, score, and user ID are required' });
    }

    const video = await YouTubeVideo.findOne({ _id: videoId, userId });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.quizzes[quizIndex]) {
      video.quizzes[quizIndex].score = score;
      video.quizzes[quizIndex].completedAt = new Date();
      video.quizzes[quizIndex].attemptedAt = new Date();
      await video.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving quiz results:', error);
    res.status(500).json({ error: 'Error saving quiz results' });
  }
};

// Search YouTube videos
const searchYouTubeVideos = async (req, res) => {
  try {
    const { query, maxResults = 3 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log('Searching YouTube for:', query);

    const yt = await Innertube.create();
    const searchResults = await yt.search(query, { type: 'video' });

    // Extract video data from search results
    const videos = searchResults.videos
      .slice(0, maxResults)
      .map(video => ({
        videoId: video.id,
        title: video.title.text || video.title,
        thumbnailUrl: video.thumbnails?.[0]?.url || video.best_thumbnail?.url || '',
        url: `https://www.youtube.com/watch?v=${video.id}`,
        duration: video.duration?.text || '',
        channelName: video.author?.name || ''
      }));

    console.log(`Found ${videos.length} videos`);
    res.json({ videos });
  } catch (error) {
    console.error('Error searching YouTube:', error);
    res.status(500).json({ error: 'Error searching YouTube videos' });
  }
};

// Delete YouTube video
const deleteYouTubeVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const video = await YouTubeVideo.findOneAndDelete({ _id: videoId, userId });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting YouTube video:', error);
    res.status(500).json({ error: 'Error deleting video' });
  }
};

module.exports = {
  upload,
  uploadVideo,
  createYouTubeVideo,
  getUserYouTubeVideos,
  chatWithYouTubeVideo,
  summarizeYouTubeVideo,
  generateQuizForYouTubeVideo,
  saveQuizResults,
  searchYouTubeVideos,
  deleteYouTubeVideo
};
