const YouTubeVideo = require('../models/youtubeVideo');
const Groq = require('groq-sdk');
const { Innertube } = require('youtubei.js');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
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
      userId
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
  createYouTubeVideo,
  getUserYouTubeVideos,
  chatWithYouTubeVideo,
  summarizeYouTubeVideo,
  generateQuizForYouTubeVideo,
  saveQuizResults,
  deleteYouTubeVideo
};
