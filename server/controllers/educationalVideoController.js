const EducationalVideo = require('../models/educationalVideo');
const Groq = require('groq-sdk');
const { Innertube } = require('youtubei.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to get real course information using Gemini AI
const getRealCourseInfo = async (videoId, platform) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
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
    
    const courseInfo = JSON.parse(cleanedText);
    
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

    const educationalVideo = new EducationalVideo({
      title: title || videoInfo.title,
      videoUrl,
      videoId,
      platform,
      description: videoInfo.description,
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
    
    if (!videoId || !message || !platform || !userId) {
      return res.status(400).json({ error: 'Video ID, message, platform, and user ID are required' });
    }

    const video = await EducationalVideo.findOne({ _id: videoId, userId });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Add user message to chat history
    video.chatHistory.push({
      role: 'user',
      content: message
    });

    // Prepare context for AI
    const context = `Video Title: ${video.title}\nVideo Description: ${video.description}\nVideo Content: ${video.transcript}\nPlatform: ${video.platform}`;
    
    // Get AI response using Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that answers questions about educational videos from various platforms (YouTube, Udemy, Coursera, Edureka, Unacademy). Use the video title, description, and content (transcript or summary) to provide accurate and helpful responses. If the transcript is not available, work with the title and description to provide the best possible answer.`
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
    console.error('Error chatting with educational video:', error);
    res.status(500).json({ error: 'Error processing chat request' });
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
          content: `You are an expert at creating comprehensive summaries of educational videos from various platforms. Create a detailed summary that covers the main topics, key points, and important insights from the video. If transcript is not available, work with the title and description to create the best possible summary.`
        },
        {
          role: "user",
          content: `Please create a comprehensive summary of this ${video.platform} video:\n\nTitle: ${video.title}\nDescription: ${video.description}\nContent: ${video.transcript}\n\nProvide a well-structured summary with main topics, key points, and important insights.`
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
    console.error('Error summarizing educational video:', error);
    res.status(500).json({ error: 'Error generating summary' });
  }
};

// Generate quiz for educational video
const generateEducationalQuiz = async (req, res) => {
  try {
    const { videoId, platform, userId } = req.body;
    
    if (!videoId || !platform || !userId) {
      return res.status(400).json({ error: 'Video ID, platform, and user ID are required' });
    }

    const video = await EducationalVideo.findOne({ _id: videoId, userId });
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
          content: `Create a quiz based on this ${video.platform} video:\n\nTitle: ${video.title}\nDescription: ${video.description}\nContent: ${video.transcript}\n\nGenerate 5-7 multiple choice questions that test understanding of the video content.`
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
    console.error('Error generating quiz for educational video:', error);
    res.status(500).json({ error: 'Error generating quiz' });
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
