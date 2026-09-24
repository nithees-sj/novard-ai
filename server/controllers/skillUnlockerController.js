const SkillPlan = require('../models/skillPlan');
const Groq = require('groq-sdk');
const { Innertube } = require('youtubei.js');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');
const { parseModelJson } = require('../utils/parseModelJson');
const { readQuizOptions, generateQuiz: generateQuizQuestions } = require('../services/quizService');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const planError = (message, status = 500) => Object.assign(new Error(message), { status });

/**
 * Generate a day-by-day plan (with a YouTube video per day) and save it.
 * Shared by the Skill Unlocker page and the Novard Agent.
 */
async function createSkillPlan({ skillName, duration, description, preferences, userId }) {
    // Validate inputs
    if (!skillName || !duration || !description || !userId) {
      throw planError('Missing required fields', 400);
    }

    if (duration < 10) {
      throw planError('Duration must be at least 10 days', 400);
    }

    // Create prompt for AI to generate learning plan
    const prompt = `Generate a ${duration}-day learning plan for "${skillName}".

Learning Goal: ${description}
Level: ${preferences?.level || 'beginner'}
${preferences?.focusAreas?.length > 0 ? `Focus Areas: ${preferences.focusAreas.join(', ')}` : ''}
Language Preference: ${preferences?.language || 'English'}
Teaching Style Preference: ${preferences?.teachingStyle || 'Standard'}

Create a structured day-by-day learning plan from absolute basics to practical application.

For each day (Days 1-${duration}), provide:
1. Topic - What specific topic to learn that day
2. Objective - Clear learning objective for that day (1-2 sentences)
3. Video Recommendation - Suggest ONE highly relevant YouTube video title.
   - Must match the preferred language (${preferences?.language || 'English'})
   - Must match the teaching style (${preferences?.teachingStyle || 'Standard'})

Requirements:
- Start from basics (no assumed prior knowledge)
- Progress logically day by day
- Include hands-on/practical days towards the end
- Make it actionable and realistic

Format your response as a JSON array like this:
[
  {
    "day": 1,
    "topic": "...",
    "objective": "...",
    "videoTitle": "..."
  },
  ...
]

IMPORTANT: Return ONLY the JSON array, no other text.`;

    // Call Groq API
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are an expert learning curriculum designer. Always return valid JSON arrays." },
        { role: "user", content: prompt },
      ],
      model: MODELS.REASONING,
      ...GROQ_DEFAULTS,
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1,
      stream: false,
    });

    const content = chatCompletion.choices[0]?.message?.content || "";
    
    // Parse the AI response
    let dailyPlanData;
    try {
      dailyPlanData = parseModelJson(content, { context: 'learning plan' });
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('AI Response:', content);
      throw planError('Failed to parse learning plan from AI');
    }


    // Format the daily plan with YouTube search
    const dailyPlan = await Promise.all(dailyPlanData.map(async (day) => {
      try {
        // Search YouTube for relevant video
        const searchQuery = `${day.videoTitle} ${skillName} tutorial in ${preferences?.language || 'English'}`;
        console.log('Searching YouTube for day', day.day, ':', searchQuery);
        
        const yt = await Innertube.create();
        const searchResults = await yt.search(searchQuery, { type: 'video' });
        
        // Get the first result
        const firstVideo = searchResults.videos?.[0];
        
        if (firstVideo) {
          return {
            day: day.day,
            topic: day.topic,
            objective: day.objective,
            youtubeVideo: {
              videoId: firstVideo.id,
              title: firstVideo.title.text || firstVideo.title,
              thumbnailUrl: firstVideo.thumbnails?.[0]?.url || firstVideo.best_thumbnail?.url || '',
              url: `https://www.youtube.com/watch?v=${firstVideo.id}`
            },
            completed: false
          };
        } else {
          // Fallback to search URL if no video found
          return {
            day: day.day,
            topic: day.topic,
            objective: day.objective,
            youtubeVideo: {
              videoId: null,
              title: day.videoTitle,
              thumbnailUrl: '',
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`
            },
            completed: false
          };
        }
      } catch (searchError) {
        console.error('Error searching for video on day', day.day, ':', searchError);
        // Fallback to search URL on error
        const searchQuery = `${day.videoTitle} ${skillName} tutorial in ${preferences?. language || 'English'}`;
        return {
          day: day.day,
          topic: day.topic,
          objective: day.objective,
          youtubeVideo: {
            videoId: null,
            title: day.videoTitle,
            thumbnailUrl: '',
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`
          },
          completed: false
        };
      }
    }));

    // Create and save skill plan
    const skillPlan = new SkillPlan({
      userId,
      skillName,
      duration,
      description,
      preferences,
      dailyPlan
    });

    await skillPlan.save();
    return skillPlan;
}
exports.createSkillPlan = createSkillPlan;

// Generate learning plan
exports.generatePlan = async (req, res) => {
  try {
    const skillPlan = await createSkillPlan(req.body);
    res.status(200).json({
      planId: skillPlan._id,
      skillName: skillPlan.skillName,
      duration: skillPlan.duration,
      dailyPlan: skillPlan.dailyPlan,
      createdAt: skillPlan.createdAt
    });
  } catch (error) {
    if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message });
    console.error('Error generating plan:', error);
    res.status(500).json({ error: error.message === 'Failed to parse learning plan from AI' ? error.message : 'Failed to generate learning plan' });
  }
};

// Generate quiz based on the learning plan
exports.generateQuiz = async (req, res) => {
  const { planId, skillName, userId } = req.body;

  try {
    if (!planId || !skillName || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const plan = await SkillPlan.findOne({ _id: planId, userId });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Only test what the student has actually covered.
    const completedDays = plan.dailyPlan.filter((day) => day.completed);
    if (completedDays.length === 0) {
      return res.status(400).json({
        error: 'Please complete at least one day of learning before taking the quiz'
      });
    }

    const options = readQuizOptions(req.body);
    const covered = completedDays
      .map((d) => `Day ${d.day}: ${d.topic} - ${d.objective}`)
      .join('\n');

    const questions = await generateQuizQuestions({
      subject: plan.skillName,
      content:
        `Skill: ${plan.skillName}\nGoal: ${plan.description}\n` +
        `Learner level: ${plan.preferences?.level || 'beginner'}\n\n` +
        `Topics the student has completed (ONLY test these):\n${covered}`,
      options,
    });

    const quizId = `quiz_${planId}_${Date.now()}`;
    plan.quizId = quizId;
    plan.quizConfiguration = { ...options, createdAt: new Date() };
    await plan.save();

    res.status(200).json({
      quizId,
      questions,
      configuration: {
        ...options,
        completedDays: completedDays.length,
        totalDays: plan.duration
      }
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to generate quiz' });
  }
};

// Get all plans for a user
exports.getUserPlans = async (req, res) => {
  const { userId } = req.params;

  try {
    const plans = await SkillPlan.find({ userId })
      .sort({ createdAt: -1 })
      .select('skillName duration createdAt quizCompleted quizScore dailyPlan');

    const formattedPlans = plans.map(plan => {
      const completedDays = plan.dailyPlan.filter(day => day.completed).length;
      const progress = Math.round((completedDays / plan.duration) * 100);

      return {
        planId: plan._id,
        skillName: plan.skillName,
        duration: plan.duration,
        createdAt: plan.createdAt,
        progress,
        completed: completedDays === plan.duration,
        quizCompleted: plan.quizCompleted,
        quizScore: plan.quizScore,
        dailyPlan: plan.dailyPlan
      };
    });

    res.status(200).json({ plans: formattedPlans });

  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
};

// Save quiz results
exports.saveQuizResult = async (req, res) => {
  const { quizId, planId, userId, score, totalQuestions, questionCount, difficulty, style, focus } = req.body;

  try {
    if (!quizId || !planId || !userId || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const plan = await SkillPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (plan.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Calculate correct answers from score
    const correctAnswers = Math.round((score / 100) * totalQuestions);
    
    // Count completed days at quiz time
    const completedDaysAtQuiz = plan.dailyPlan.filter(day => day.completed).length;

    // Create quiz result entry
    const quizResult = {
      score,
      correctAnswers,
      totalQuestions,
      questionCount: questionCount || totalQuestions,
      style,
      focus,
      difficulty: difficulty || plan.quizConfiguration?.difficulty || 'intermediate',
      completedDaysAtQuiz,
      completedAt: new Date()
    };

    // Append to quiz results array
    if (!plan.quizResults) {
      plan.quizResults = [];
    }
    plan.quizResults.push(quizResult);

    // Also update legacy fields for backward compatibility
    plan.quizCompleted = true;
    plan.quizScore = score;
    
    await plan.save();

    res.status(200).json({
      message: 'Quiz results saved successfully',
      score,
      totalQuestions,
      result: quizResult
    });

  } catch (error) {
    console.error('Error saving quiz results:', error);
    res.status(500).json({ error: 'Failed to save quiz results' });
  }
};

// Mark day as complete/incomplete
exports.toggleDayCompletion = async (req, res) => {
  const { planId, dayNumber, userId } = req.body;

  try {
    const plan = await SkillPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (plan.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const dayIndex = plan.dailyPlan.findIndex(day => day.day === dayNumber);
    if (dayIndex === -1) {
      return res.status(404).json({ error: 'Day not found' });
    }

    // Toggle completion
    plan.dailyPlan[dayIndex].completed = !plan.dailyPlan[dayIndex].completed;
    plan.dailyPlan[dayIndex].completedAt = plan.dailyPlan[dayIndex].completed ? new Date() : null;
    
    await plan.save();

    res.status(200).json({
      message: 'Day completion toggled',
      completed: plan.dailyPlan[dayIndex].completed
    });

  } catch (error) {
    console.error('Error toggling day completion:', error);
    res.status(500).json({ error: 'Failed to toggle day completion' });
  }
};

// Delete a skill plan
exports.deletePlan = async (req, res) => {
  const { planId } = req.params;
  
  try {
    const plan = await SkillPlan.findByIdAndDelete(planId);
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.status(200).json({ message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
};

// Refresh video for a specific day
exports.refreshVideo = async (req, res) => {
  const { planId, dayNumber } = req.body;

  try {
    const plan = await SkillPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const day = plan.dailyPlan.find(d => d.day === dayNumber);
    if (!day) {
      return res.status(404).json({ error: 'Day not found' });
    }

    // Search YouTube for an alternative video
    const searchQuery = `${day.topic} ${plan.skillName} tutorial in ${plan.preferences?.language || 'English'}`;
    console.log('Searching YouTube for alternative video:', searchQuery);
    
    const yt = await Innertube.create();
    const searchResults = await yt.search(searchQuery, { type: 'video' });
    
    // Get up to 5 results and filter out the current video
    const videos = searchResults.videos.slice(0, 5);
    const currentVideoId = day.youtubeVideo?.videoId;
    
    // Find a different video than the current one
    const newVideo = videos.find(v => v.id !== currentVideoId) || videos[0];
    
    if (newVideo) {
      day.youtubeVideo = {
        videoId: newVideo.id,
        title: newVideo.title.text || newVideo.title,
        thumbnailUrl: newVideo.thumbnails?.[0]?.url || newVideo.best_thumbnail?.url || '',
        url: `https://www.youtube.com/watch?v=${newVideo.id}`
      };
      await plan.save();
      
      return res.status(200).json({ 
        message: 'Video refreshed',
        youtubeVideo: day.youtubeVideo
      });
    } else {
      return res.status(500).json({ error: 'No alternative videos found' });
    }

  } catch (error) {
    console.error('Error refreshing video:', error);
    res.status(500).json({ error: 'Failed to refresh video' });
  }
};
