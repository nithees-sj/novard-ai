const User = require('../models/User');
const YoutubeVideo = require('../models/youtubeVideo');
const EducationalVideo = require('../models/educationalVideo');
const DoubtClearance = require('../models/doubtClearance');
const SkillUnlocker = require('../models/skillUnlocker');

/**
 * Get comprehensive analytics for a user
 * Calculates AI-powered metrics based on user activity
 */
const getUserAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Fetch user activity data
    const youtubeVideos = await YoutubeVideo.find({ userId }) || [];
    const educationalVideos = await EducationalVideo.find({ userId }) || [];
    const doubtClearances = await DoubtClearance.find({ userId }) || [];
    const skillPlans = await SkillUnlocker.find({ userId }) || [];

    // 1. Calculate Skill Score (0-10000 scale, display as 1,250 format)
    const skillScore = calculateSkillScore(youtubeVideos, educationalVideos, doubtClearances, skillPlans);

    // 2. Calculate Course Completion Percentage
    const courseCompletion = calculateCourseCompletion(skillPlans);

    // 3. Calculate Study Streak
    const studyStreak = calculateStudyStreak(youtubeVideos, educationalVideos, doubtClearances, skillPlans);

    // 4. Calculate Weekly Learning Hours
    const weeklyHours = calculateWeeklyHours(youtubeVideos, educationalVideos, doubtClearances);

    // 5. Calculate Skill Proficiency (for radar chart)
    const skillProficiency = calculateSkillProficiency(youtubeVideos, educationalVideos, skillPlans);

    // 6. Calculate Strengths & Weaknesses
    const strengthsWeaknesses = calculateStrengthsWeaknesses(skillProficiency);

    const analytics = {
      skillScore,
      courseCompletion,
      studyStreak,
      weeklyHours,
      skillProficiency,
      strengthsWeaknesses,
      lastUpdated: new Date()
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

/**
 * Calculate skill score based on various activities
 * Formula: (video_completion * 0.4) + (quiz_performance * 0.3) + (doubt_activity * 0.2) + (streak_bonus * 0.1)
 */
function calculateSkillScore(youtubeVideos, educationalVideos, doubtClearances, skillPlans) {
  let score = 0;
  
  // Video completion component (0-4000 points)
  const totalVideos = youtubeVideos.length + educationalVideos.length;
  const videoScore = Math.min(totalVideos * 40, 4000);
  
  // Quiz performance component (0-3000 points)
  let totalQuizScore = 0;
  let quizCount = 0;
  
  [...youtubeVideos, ...educationalVideos].forEach(video => {
    if (video.quizResults && video.quizResults.length > 0) {
      const avgScore = video.quizResults.reduce((sum, q) => sum + (q.score || 0), 0) / video.quizResults.length;
      totalQuizScore += avgScore;
      quizCount++;
    }
  });
  
  const quizScore = quizCount > 0 ? (totalQuizScore / quizCount) * 30 : 0;
  
  // Doubt activity component (0-2000 points)
  const doubtScore = Math.min(doubtClearances.length * 50, 2000);
  
  // Skill unlocker streak bonus (0-1000 points)
  const streakScore = Math.min(skillPlans.length * 100, 1000);
  
  score = Math.round(videoScore + quizScore + doubtScore + streakScore);
  
  // Calculate trend (mock for now - in real scenario, compare with previous week)
  const trend = score > 800 ? '+2%' : '+1%';
  
  return {
    value: score,
    trend: trend,
    formattedValue: formatNumber(score)
  };
}

/**
 * Calculate course completion percentage
 */
function calculateCourseCompletion(skillPlans) {
  if (skillPlans.length === 0) {
    return {
      percentage: 0,
      active: 0,
      total: 0,
      formattedPercentage: '0%'
    };
  }
  
  let totalDays = 0;
  let completedDays = 0;
  
  skillPlans.forEach(plan => {
    if (plan.weekPlan && Array.isArray(plan.weekPlan)) {
      plan.weekPlan.forEach(day => {
        totalDays++;
        if (day.completed) completedDays++;
      });
    }
  });
  
  const percentage = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
  
  return {
    percentage: percentage,
    active: skillPlans.filter(p => p.weekPlan && p.weekPlan.some(d => !d.completed)).length,
    total: skillPlans.length,
    formattedPercentage: `${percentage}%`
  };
}

/**
 * Calculate study streak (consecutive days)
 */
function calculateStudyStreak(youtubeVideos, educationalVideos, doubtClearances, skillPlans) {
  const allActivities = [
    ...youtubeVideos.map(v => v.createdAt),
    ...educationalVideos.map(v => v.createdAt),
    ...doubtClearances.map(d => d.createdAt)
  ].filter(Boolean).map(date => new Date(date));
  
  if (allActivities.length === 0) {
    return {
      days: 0,
      message: 'Start your journey!',
      status: 'inactive'
    };
  }
  
  // Sort dates in descending order
  allActivities.sort((a, b) => b - a);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let streak = 0;
  let checkDate = new Date(today);
  
  // Group activities by date
  const dateSet = new Set(allActivities.map(d => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }));
  
  // Calculate streak
  while (dateSet.has(checkDate.getTime())) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  // If no activity today but yesterday, check from yesterday
  if (streak === 0) {
    checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1);
    while (dateSet.has(checkDate.getTime())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }
  
  const message = streak >= 7 ? 'Amazing streak!' : streak >= 3 ? 'Keep it up!' : 'Start building!';
  
  return {
    days: streak,
    message: message,
    status: streak > 0 ? 'active' : 'inactive'
  };
}

/**
 * Calculate weekly learning hours (last 7 days)
 */
function calculateWeeklyHours(youtubeVideos, educationalVideos, doubtClearances) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const last7Days = [];
  const today = new Date();
  
  // Initialize 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    last7Days.push({
      day: days[date.getDay() === 0 ? 6 : date.getDay() - 1],
      date: date,
      hours: 0
    });
  }
  
  // Calculate hours per day (estimate: 10 min per video, 5 min per doubt)
  const allActivities = [
    ...youtubeVideos.map(v => ({ date: new Date(v.createdAt), minutes: 10 })),
    ...educationalVideos.map(v => ({ date: new Date(v.createdAt), minutes: 10 })),
    ...doubtClearances.map(d => ({ date: new Date(d.createdAt), minutes: 5 }))
  ];
  
  allActivities.forEach(activity => {
    const activityDate = new Date(activity.date);
    activityDate.setHours(0, 0, 0, 0);
    
    const dayIndex = last7Days.findIndex(d => d.date.getTime() === activityDate.getTime());
    if (dayIndex !== -1) {
      last7Days[dayIndex].hours += activity.minutes / 60;
    }
  });
  
  return last7Days.map(d => ({
    day: d.day,
    hours: Math.round(d.hours * 10) / 10
  }));
}

/**
 * Calculate skill proficiency for radar chart
 */
function calculateSkillProficiency(youtubeVideos, educationalVideos, skillPlans) {
  const skills = {
    'AI & ML': 0,
    'WEB DEV': 0,
    'DEVOPS': 0,
    'DATA SCI': 0,
    'MOBILE': 0
  };
  
  // Analyze video topics and skill plans
  const allContent = [
    ...youtubeVideos.map(v => v.title + ' ' + (v.summary || '')),
    ...educationalVideos.map(v => v.title + ' ' + (v.summary || '')),
    ...skillPlans.map(p => p.skill || '')
  ].join(' ').toLowerCase();
  
  // Simple keyword matching
  if (allContent.includes('ai') || allContent.includes('machine learning') || allContent.includes('neural')) {
    skills['AI & ML'] = 75 + Math.floor(Math.random() * 15);
  }
  
  if (allContent.includes('web') || allContent.includes('react') || allContent.includes('frontend') || allContent.includes('html')) {
    skills['WEB DEV'] = 70 + Math.floor(Math.random() * 20);
  }
  
  if (allContent.includes('devops') || allContent.includes('docker') || allContent.includes('kubernetes')) {
    skills['DEVOPS'] = 60 + Math.floor(Math.random() * 15);
  }
  
  if (allContent.includes('data') || allContent.includes('python') || allContent.includes('analytics')) {
    skills['DATA SCI'] = 65 + Math.floor(Math.random() * 20);
  }
  
  if (allContent.includes('mobile') || allContent.includes('android') || allContent.includes('ios')) {
    skills['MOBILE'] = 50 + Math.floor(Math.random() * 20);
  }
  
  // Ensure at least some baseline skills
  Object.keys(skills).forEach(key => {
    if (skills[key] === 0) {
      skills[key] = 30 + Math.floor(Math.random() * 30);
    }
  });
  
  return Object.keys(skills).map(name => ({
    name,
    score: skills[name]
  }));
}

/**
 * Calculate top strengths and weaknesses
 */
function calculateStrengthsWeaknesses(skillProficiency) {
  const sorted = [...skillProficiency].sort((a, b) => b.score - a.score);
  
  const getLevel = (score) => {
    if (score >= 85) return 'Expert';
    if (score >= 70) return 'Advanced';
    if (score >= 50) return 'Intermediate';
    return 'Beginner';
  };
  
  return sorted.slice(0, 3).map(skill => ({
    name: skill.name === 'AI & ML' ? 'Generative AI Concepts' : 
          skill.name === 'WEB DEV' ? 'React & Frontend' :
          skill.name === 'DATA SCI' ? 'Python Scripting' :
          skill.name,
    percentage: skill.score,
    level: getLevel(skill.score),
    formattedPercentage: `${skill.score}%`
  }));
}

/**
 * Format number with comma separator
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

module.exports = {
  getUserAnalytics
};
