const YouTubeVideo = require('../models/youtubeVideo');
const Groq = require('groq-sdk');
const { Innertube } = require('youtubei.js');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

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
      model: "llama-3.1-8b-instant",
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
    
    if (!videoId || !message || !userId) {
      return res.status(400).json({ error: 'Video ID, message, and user ID are required' });
    }

    const video = await YouTubeVideo.findOne({ _id: videoId, userId });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Add user message to chat history
    video.chatHistory.push({
      role: 'user',
      content: message
    });

    // Prepare context for AI
    const context = `Video Title: ${video.title}\nVideo Description: ${video.description}\nVideo Content: ${video.transcript}`;
    
    // Get AI response using Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers questions about YouTube videos. Use the video title, description, and content (transcript or summary) to provide accurate and helpful responses. If the transcript is not available, work with the title and description to provide the best possible answer."
        },
        {
          role: "user",
          content: `Video Information:\n${context}\n\nUser Question: ${message}\n\nPlease provide a helpful answer based on the video content.`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Add AI response to chat history
    video.chatHistory.push({
      role: 'assistant',
      content: aiResponse
    });

    await video.save();
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error chatting with YouTube video:', error);
    res.status(500).json({ error: 'Error processing chat request' });
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
          content: "You are an expert at creating comprehensive summaries of YouTube videos. Create a detailed summary that covers the main topics, key points, and important insights from the video. If transcript is not available, work with the title and description to create the best possible summary."
        },
        {
          role: "user",
          content: `Please create a comprehensive summary of this YouTube video:\n\nTitle: ${video.title}\nDescription: ${video.description}\nContent: ${video.transcript}\n\nProvide a well-structured summary with main topics, key points, and important insights.`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 1500,
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

    // Generate quiz using Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert at creating educational quizzes. Generate 5-7 multiple choice questions based on the video content. IMPORTANT: Return ONLY valid JSON format with this exact structure: {\"questions\": [{\"question\": \"string\", \"options\": [\"string\", \"string\", \"string\", \"string\"], \"correctAnswer\": 0, \"explanation\": \"string\"}]}. Do not include any markdown code blocks, explanations, or additional text. Just return the raw JSON. If transcript is not available, create questions based on the title and description."
        },
        {
          role: "user",
          content: `Create a quiz based on this YouTube video:\n\nTitle: ${video.title}\nDescription: ${video.description}\nContent: ${video.transcript}\n\nGenerate 5-7 multiple choice questions that test understanding of the video content.`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 2000,
    });

    const quizResponse = completion.choices[0]?.message?.content || '{}';
    
    try {
      // Clean the response by removing markdown code blocks
      let cleanedResponse = quizResponse.trim();
      
      // Remove ```json and ``` markers if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to extract JSON from the response if it's wrapped in other text
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      console.log('Cleaned quiz response:', cleanedResponse);
      const quizData = JSON.parse(cleanedResponse);
      
      // Validate quiz structure
      if (!quizData.questions || !Array.isArray(quizData.questions)) {
        throw new Error('Invalid quiz format');
      }

      // Add quiz to video
      video.quizzes.push({
        questions: quizData.questions,
        totalQuestions: quizData.questions.length
      });

      await video.save();
      res.json({ quiz: quizData.questions });
    } catch (parseError) {
      console.error('Error parsing quiz response:', parseError);
      res.status(500).json({ error: 'Error generating quiz format' });
    }
  } catch (error) {
    console.error('Error generating quiz for YouTube video:', error);
    res.status(500).json({ error: 'Error generating quiz' });
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
