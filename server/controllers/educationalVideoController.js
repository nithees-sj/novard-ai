const EducationalVideo = require('../models/educationalVideo');
const Groq = require('groq-sdk');
const { Innertube } = require('youtubei.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');
const { parseModelJson } = require('../utils/parseModelJson');
const { MARKDOWN_WITH_FLOWCHART } = require('../config/prompts');
const { readQuizOptions, generateQuiz: generateQuizQuestions, sampleContent } = require('../services/quizService');
const { converse } = require('../ai/conversation');
const { videoTutorPrompt } = require('../ai/prompts');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Accept either name: the code has always read GEMINI_API_KEY while the
// Docker/Cloud Run configs pass GOOGLE_API_KEY, which silently disabled
// Gemini-backed course discovery in containers.
const googleApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(googleApiKey);

// Function to get real course information using Gemini AI
const getRealCourseInfo = async (videoId, platform) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODELS.GEMINI });
    
    const prompt = `Find detailed information about a ${platform} course with ID "${videoId}". Return ONLY a JSON object with this exact format:
    {"title": "Course Title", "description": "Detailed course description", "instructor": "Instructor Name", "rating": "4.5", "price": "$89.99", "enrollments": 50000, "transcript": "Course content overview and key topics covered"}
    Make sure the information is accurate and the course exists on ${platform}.`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean the response to extract JSON
    let cleanedText = text.trim();
    
    // Remove markdown code blocks if present
    if (cleanedText.includes('```json')) {
      cleanedText = cleanedText.replace(/```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.includes('```')) {
      cleanedText = cleanedText.replace(/```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Extract JSON object from the response
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }
    
    console.log(`Gemini course info for ${platform} - ${videoId}:`, cleanedText);
    
    const courseInfo = parseModelJson(cleanedText, { context: 'course details' });
    
    return {
      title: courseInfo.title,
      description: courseInfo.description,
      transcript: courseInfo.transcript || courseInfo.description
    };
    
  } catch (error) {
    console.error(`Error getting real course info for ${platform}:`, error);
    // Fallback to generic course info
    return {
      title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Course - ${videoId}`,
      description: `Comprehensive educational course from ${platform}. This course covers important topics and provides hands-on learning experience with real-world projects and examples.`,
      transcript: `This is a comprehensive course on ${platform}. The course covers important concepts, practical examples, and hands-on exercises. Students will learn through video lectures, assignments, and projects. The course is designed for both beginners and intermediate learners who want to master the subject matter. You'll gain practical skills and real-world experience that you can apply immediately in your career.`
    };
  }
};

// Helper function to extract video ID from various platform URLs
/** Clip a value to a schema maxlength, leaving a marker when it was cut. */
const truncate = (value, limit) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}\u2026`;
};

const extractVideoId = (url, platform) => {
  switch (platform) {
    case 'youtube':
      const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
      const youtubeMatch = url.match(youtubeRegex);
      return youtubeMatch ? youtubeMatch[1] : null;
    
    case 'udemy':
      // More flexible Udemy URL matching
      const udemyRegex = /udemy\.com\/course\/([\w-]+)/;
      const udemyMatch = url.match(udemyRegex);
      return udemyMatch ? udemyMatch[1] : null;
    
    case 'coursera':
      // More flexible Coursera URL matching
      const courseraRegex = /coursera\.org\/(?:learn|specializations)\/([\w-]+)/;
      const courseraMatch = url.match(courseraRegex);
      return courseraMatch ? courseraMatch[1] : null;
    
    case 'edureka':
      // More flexible Edureka URL matching
      const edurekaRegex = /edureka\.co\/(?:masters-program\/|data-science-|aws-)?([\w-]+)/;
      const edurekaMatch = url.match(edurekaRegex);
      return edurekaMatch ? edurekaMatch[1] : null;
    
    
    default:
      return null;
  }
};

// Helper function to get video info based on platform
const getVideoInfo = async (videoId, platform) => {
  try {
    if (platform === 'youtube') {
      const yt = await Innertube.create();
      const info = await yt.getInfo(videoId);
      
      return {
        title: info.basic_info.title || `YouTube Video ${videoId}`,
        description: info.basic_info.short_description || info.basic_info.description || 'No description available'
      };
    } else {
      // For other platforms, use Gemini AI to get real course information
      return await getRealCourseInfo(videoId, platform);
    }
  } catch (error) {
    console.error('Error fetching video info:', error);
    return {
      title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Course ${videoId}`,
      description: 'Educational content with comprehensive learning materials and practical examples.'
    };
  }
};

// Helper function to get video transcript based on platform
const getVideoTranscript = async (videoId, platform) => {
  try {
    if (platform === 'youtube') {
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
    } else {
      // For other platforms, use Gemini AI to get real course transcript
      const courseInfo = await getRealCourseInfo(videoId, platform);
      return courseInfo.transcript || courseInfo.description;
    }
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return `Unable to fetch video transcript. You can still ask questions about the video based on its title and description.`;
  }
};

// Create new educational video entry
const createEducationalVideo = async (req, res) => {
  try {
    const { title, videoUrl, platform, userId } = req.body;
    
    if (!title || !videoUrl || !platform || !userId) {
      return res.status(400).json({ error: 'Title, video URL, platform, and user ID are required' });
    }

    const videoId = extractVideoId(videoUrl, platform);
    if (!videoId) {
      return res.status(400).json({ error: `Invalid ${platform} URL` });
    }

    // Check if video already exists for this user
    const existingVideo = await EducationalVideo.findOne({ 
      videoId: videoId, 
      platform: platform,
      userId: userId 
    });
    
    if (existingVideo) {
      return res.status(400).json({ error: 'This video has already been added' });
    }

    // Get video info and transcript
    const videoInfo = await getVideoInfo(videoId, platform);
    const transcript = await getVideoTranscript(videoId, platform);
    
    console.log('Video Info:', videoInfo);
    console.log('Transcript length:', transcript.length);

    // The schema caps title at 200 and description at 2000 characters, but
    // real YouTube descriptions routinely run far longer. Saving them raw made
    // Mongoose reject every genuine video with a validation error, surfaced to
    // the user as a generic 500. Truncate to fit; the transcript (uncapped)
    // still carries the full content used for summaries and quizzes.
    const educationalVideo = new EducationalVideo({
      title: truncate(title || videoInfo.title, 200),
      videoUrl,
      videoId,
      platform,
      description: truncate(videoInfo.description, 2000),
      transcript,
      userId
    });

    await educationalVideo.save();
    res.status(201).json(educationalVideo);
  } catch (error) {
    console.error('Error creating educational video:', error);
    res.status(500).json({ error: 'Error creating educational video' });
  }
};

// Get user's educational videos
const getUserEducationalVideos = async (req, res) => {
  try {
    const { userId } = req.params;
    const videos = await EducationalVideo.find({ userId }).sort({ createdAt: -1 });
    res.json(videos);
  } catch (error) {
    console.error('Error getting user educational videos:', error);
    res.status(500).json({ error: 'Error getting educational videos' });
  }
};

// Chat with educational video
const chatWithEducationalVideo = async (req, res) => {
  try {
    const { videoId, message, platform, userId } = req.body;
    const question = String(message || '').trim();
    if (!videoId || !question || !userId) {
      return res.status(400).json({ error: 'Video ID, message, and user ID are required' });
    }

    const video = await EducationalVideo.findOne({ _id: videoId, userId }).select('title description summary transcript platform');
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const aiResponse = await converse({
      Model: EducationalVideo,
      filter: { _id: video._id, userId },
      field: 'chatHistory',
      timeKey: 'timestamp',
      system: videoTutorPrompt(video, { platform: platform || video.platform }),
      input: question,
      tier: 'FAST',
      maxTokens: 2500,
      temperature: 0.5,
    });

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error chatting with educational video:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error processing chat message' });
  }
};

// Summarize educational video
const summarizeEducationalVideo = async (req, res) => {
  try {
    const { videoId, platform, userId } = req.body;
    
    if (!videoId || !platform || !userId) {
      return res.status(400).json({ error: 'Video ID, platform, and user ID are required' });
    }

    const video = await EducationalVideo.findOne({ _id: videoId, userId });
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
          content: `You are an expert at creating comprehensive summaries of educational videos from various platforms. Create a detailed summary that covers the main topics, key points, and important insights from the video. If transcript is not available, work with the title and description to create the best possible summary.

${MARKDOWN_WITH_FLOWCHART}`
        },
        {
          role: "user",
          content: `Please create a comprehensive summary of this ${video.platform} video:\n\nTitle: ${video.title}\nDescription: ${video.description}\nContent: ${video.transcript}\n\nProvide a well-structured summary with main topics, key points, and important insights.`
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
    console.error('Error summarizing educational video:', error);
    res.status(500).json({ error: 'Error generating summary' });
  }
};

// Generate quiz for educational video
const generateEducationalQuiz = async (req, res) => {
  try {
    const { videoId, userId } = req.body;
    if (!videoId || !userId) {
      return res.status(400).json({ error: 'Video ID and user ID are required' });
    }

    const video = await EducationalVideo.findOne({ _id: videoId, userId });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const options = readQuizOptions(req.body);
    const questions = await generateQuizQuestions({
      subject: video.title,
      content: sampleContent(
        `Title: ${video.title}\nPlatform: ${video.platform}\nDescription: ${video.description || ''}\n` +
        `Summary: ${video.summary || ''}\nTranscript: ${video.transcript || ''}`
      ),
      options,
      model: MODELS.REASONING,
    });

    video.quizzes.push({ questions, totalQuestions: questions.length, settings: options });
    await video.save();
    res.json({ quiz: questions, quizIndex: video.quizzes.length - 1, settings: options });
  } catch (error) {
    console.error('Error generating educational quiz:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error generating quiz' });
  }
};

// Save quiz results
const saveEducationalQuizResults = async (req, res) => {
  try {
    const { videoId, platform, quizIndex, score, userId } = req.body;
    
    if (!videoId || !platform || quizIndex === undefined || score === undefined || !userId) {
      return res.status(400).json({ error: 'Video ID, platform, quiz index, score, and user ID are required' });
    }

    const video = await EducationalVideo.findOne({ _id: videoId, userId });
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

// Delete educational video
const deleteEducationalVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const video = await EducationalVideo.findOneAndDelete({ _id: videoId, userId });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting educational video:', error);
    res.status(500).json({ error: 'Error deleting video' });
  }
};

module.exports = {
  createEducationalVideo,
  getUserEducationalVideos,
  chatWithEducationalVideo,
  summarizeEducationalVideo,
  generateEducationalQuiz,
  saveEducationalQuizResults,
  deleteEducationalVideo
};
