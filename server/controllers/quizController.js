const Course = require('../models/course');
const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Generate quiz for a video
const generateQuizForVideo = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const { videoTitle, videoDescription, videoContentSummary } = req.body;

    // Debug logging
    console.log('Quiz generation request:', {
      courseId,
      videoId,
      videoTitle,
      videoDescription,
      videoContentSummary
    });

    if (!videoTitle) {
      return res.status(400).json({ error: 'Video title is required' });
    }

    // Generate quiz using Groq AI with enhanced content analysis
    const prompt = `Generate an educational quiz based on the video titled "${videoTitle}".

    Video Description: ${videoDescription || 'No description provided'}
    Video Content Summary: ${videoContentSummary || 'No content summary provided'}
    
    IMPORTANT: Create 5 multiple choice questions that test understanding of the educational content. 
    ${videoContentSummary ? 
      'Use the provided content summary to create questions based on the specific topics and concepts covered in the video.' :
      'Since no content summary was provided, create general educational questions based on the video title and description that would be appropriate for learning assessment.'
    }
    
    The questions should be:
    - Educational and meaningful for learning assessment
    - Progressive in difficulty (start with basic concepts, move to application)
    - Relevant to the subject matter and learning objectives
    - Based on key concepts, facts, or skills that would typically be taught in this type of video
    
    For each question:
    - Make the correct answer clearly correct based on the video content
    - Make incorrect options plausible but clearly wrong
    - Provide educational explanations that reinforce learning
    
    Return ONLY valid JSON with this exact structure (no markdown, no code blocks, no extra text):
    {
      "title": "Quiz Title",
      "description": "Quiz description",
      "questions": [
        {
          "question": "Question text",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0,
          "explanation": "Why this answer is correct"
        }
      ]
    }`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 2000
    });

    const quizContent = completion.choices[0]?.message?.content;
    
    if (!quizContent) {
      return res.status(500).json({ error: 'Failed to generate quiz content' });
    }

    // Extract JSON from the response (handle markdown code blocks)
    let jsonString = quizContent.trim();
    
    // Remove markdown code blocks if present
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Try to find JSON object in the response
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }

    // Parse the JSON response
    let quizData;
    try {
      quizData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Error parsing quiz JSON:', parseError);
      console.error('Raw content:', quizContent);
      console.error('Extracted JSON:', jsonString);
      return res.status(500).json({ error: 'Failed to parse quiz content' });
    }

    // Find the course and video
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const video = course.videos.id(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Add quiz to video
    const quiz = {
      title: quizData.title || `${videoTitle} Quiz`,
      description: quizData.description || `Test your understanding of ${videoTitle}`,
      questions: quizData.questions || [],
      createdAt: new Date()
    };

    video.quiz = quiz;
    course.updatedAt = new Date();
    
    const updatedCourse = await course.save();
    const updatedVideo = updatedCourse.videos.id(videoId);

    res.json({
      success: true,
      quiz: updatedVideo.quiz,
      message: 'Quiz generated successfully'
    });

  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
};

// Get quiz for a video
const getVideoQuiz = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const video = course.videos.id(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (!video.quiz) {
      return res.status(404).json({ error: 'No quiz found for this video' });
    }

    res.json(video.quiz);
  } catch (error) {
    console.error('Error getting video quiz:', error);
    res.status(500).json({ error: 'Failed to get video quiz' });
  }
};

// Submit quiz answers
const submitQuizAnswers = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const { answers, userEmail } = req.body;

    if (!answers || !userEmail) {
      return res.status(400).json({ error: 'Answers and user email are required' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const video = course.videos.id(videoId);
    if (!video || !video.quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Calculate score
    let correctAnswers = 0;
    const quiz = video.quiz;
    
    answers.forEach((answer, index) => {
      if (quiz.questions[index] && answer === quiz.questions[index].correctAnswer) {
        correctAnswers++;
      }
    });

    const score = Math.round((correctAnswers / quiz.questions.length) * 100);

    // Store quiz result
    const quizResult = {
      userEmail,
      answers,
      score,
      correctAnswers,
      totalQuestions: quiz.questions.length,
      completedAt: new Date()
    };

    if (!video.quizResults) {
      video.quizResults = [];
    }
    
    // Check if user already took this quiz
    const existingResultIndex = video.quizResults.findIndex(
      result => result.userEmail === userEmail
    );
    
    if (existingResultIndex >= 0) {
      video.quizResults[existingResultIndex] = quizResult;
    } else {
      video.quizResults.push(quizResult);
    }

    course.updatedAt = new Date();
    await course.save();

    res.json({
      success: true,
      score,
      correctAnswers,
      totalQuestions: quiz.questions.length,
      message: 'Quiz submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting quiz answers:', error);
    res.status(500).json({ error: 'Failed to submit quiz answers' });
  }
};

// Get quiz results for a video
const getQuizResults = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const video = course.videos.id(videoId);
    if (!video || !video.quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    res.json({
      quiz: video.quiz,
      results: video.quizResults || []
    });

  } catch (error) {
    console.error('Error getting quiz results:', error);
    res.status(500).json({ error: 'Failed to get quiz results' });
  }
};

module.exports = {
  generateQuizForVideo,
  getVideoQuiz,
  submitQuizAnswers,
  getQuizResults
};
