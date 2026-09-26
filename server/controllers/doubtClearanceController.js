const DoubtClearance = require('../models/doubtClearance');
const Groq = require('groq-sdk');
const youtubesearchapi = require('youtube-search-api');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');
const { parseModelJson } = require('../utils/parseModelJson');
const { MARKDOWN_WITH_FLOWCHART } = require('../config/prompts');
const { readQuizOptions, generateQuiz: generateQuizQuestions, sampleContent } = require('../services/quizService');
const { converse } = require('../ai/conversation');
const { FORMAT_RULES } = require('../ai/prompts');
const { contextualTitle } = require('../services/doubtTitle');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Helper function to search YouTube videos using youtube-search-api
const searchYouTubeVideos = async (query, maxResults = 6) => {
  try {
    console.log(`Searching YouTube for: "${query}"`);
    
    const searchResults = await youtubesearchapi.GetListByKeyword(query, false, maxResults, [{ type: 'video' }]);
    
    console.log(`Search results for "${query}":`, searchResults.items?.length || 0, 'videos found');
    
    const videos = [];
    const results = searchResults.items || [];
    
    for (let i = 0; i < Math.min(maxResults, results.length); i++) {
      const video = results[i];
      if (video.type === 'video') {
        const videoData = {
          title: video.title || 'No title',
          description: video.description || 'No description',
          thumbnail: video.thumbnail?.thumbnails?.[video.thumbnail.thumbnails.length - 1]?.url || `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          duration: video.length?.text || 'Unknown',
          reason: `Found using keywords: ${query}`
        };
        videos.push(videoData);
        console.log(`Found video: ${videoData.title}`);
      }
    }
    
    console.log(`Returning ${videos.length} videos for query: "${query}"`);
    return videos;
  } catch (error) {
    console.error(`Error searching YouTube for "${query}":`, error);
    return [];
  }
};

// Get all doubt clearances for a user
const getUserDoubtClearances = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const doubtClearances = await DoubtClearance.find({ userId }).sort({ createdAt: -1 });
    
    res.json(doubtClearances);
  } catch (error) {
    console.error('Error getting user doubt clearances:', error);
    res.status(500).json({ error: 'Failed to get doubt clearances' });
  }
};

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

/**
 * Validate and save a new doubt. Shared by the Doubt Clearance page and the Novard Agent.
 * The title is written by the AI from the question (the student's own title, if any,
 * is only a hint); `keepTitle` keeps a title that is already specific, e.g. the agent's.
 */
const createDoubt = async ({ title, description, imageUrl, userId }, { keepTitle = false } = {}) => {
  if (!description?.trim() || !userId) {
    throw badRequest('Describe your doubt, and include userId.');
  }
  // Same limits as the schema, reported clearly instead of as a generic 500.
  if (title && title.trim().length > 200) throw badRequest('The title must be 200 characters or fewer.');
  if (description.trim().length > 2000) throw badRequest('The description must be 2000 characters or fewer.');
  let image = null;
  if (imageUrl && String(imageUrl).trim()) {
    try {
      const url = new URL(String(imageUrl).trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad scheme');
      image = url.toString();
    } catch {
      throw badRequest('The image link must be a full http:// or https:// URL.');
    }
  }

  const finalTitle = keepTitle && title?.trim()
    ? title.trim()
    : await contextualTitle({ title, description });

  return new DoubtClearance({
    title: finalTitle,
    description: description.trim(),
    imageUrl: image,
    userId,
    chatHistory: [],
    summary: '',
    quizzes: [],
    youtubeRecommendations: []
  }).save();
};

// Create a new doubt clearance
const createDoubtClearance = async (req, res) => {
  try {
    const saved = await createDoubt(req.body);
    res.status(201).json(saved);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error creating doubt clearance:', error);
    res.status(500).json({ error: 'Failed to create doubt clearance' });
  }
};

// Delete a doubt clearance
const deleteDoubtClearance = async (req, res) => {
  try {
    const { doubtId } = req.params;

    const doubtClearance = await DoubtClearance.findByIdAndDelete(doubtId);
    
    if (!doubtClearance) {
      return res.status(404).json({ error: 'Doubt clearance not found' });
    }

    res.json({ message: 'Doubt clearance deleted successfully' });
  } catch (error) {
    console.error('Error deleting doubt clearance:', error);
    res.status(500).json({ error: 'Failed to delete doubt clearance' });
  }
};

// Chat with doubt clearance
const chatWithDoubtClearance = async (req, res) => {
  try {
    const { doubtId, message, userId } = req.body;
    const question = String(message || '').trim();
    if (!doubtId || !question || !userId) {
      return res.status(400).json({ error: 'Doubt ID, message, and userId are required' });
    }

    const doubt = await DoubtClearance.findOne({ _id: doubtId, userId }).select('title description imageUrl');
    if (!doubt) {
      return res.status(404).json({ error: 'Doubt clearance not found' });
    }

    const system = `You are a patient tutor helping a student clear one specific doubt.

THE DOUBT
Title: ${doubt.title}
Details: ${doubt.description}${doubt.imageUrl ? `\nThe student attached an image link (you cannot see it): ${doubt.imageUrl}` : ''}

Teaching approach:
- Find the exact point of confusion and address that first, in plain language.
- Build understanding step by step; use a concrete example, analogy or code where it helps.
- When there is a common misconception behind the doubt, name it.
- If the student seems stuck, check understanding with a quick question at the end.

${FORMAT_RULES}`;

    // The whole doubt thread is memory: the student can refer back to any earlier
    // explanation. Long threads are summarised instead of growing without limit.
    const aiResponse = await converse({
      Model: DoubtClearance,
      filter: { _id: doubt._id, userId },
      field: 'chatHistory',
      timeKey: 'timestamp',
      system,
      input: question,
      tier: 'REASONING',
      maxTokens: 3200,
      temperature: 0.5,
    });
    await DoubtClearance.updateOne({ _id: doubt._id }, { $set: { updatedAt: new Date() } });

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error chatting with doubt clearance:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to process chat message' });
  }
};

// Summarize doubt clearance
const summarizeDoubtClearance = async (req, res) => {
  try {
    const { doubtId, userId } = req.body;

    if (!doubtId || !userId) {
      return res.status(400).json({ error: 'Doubt ID and userId are required' });
    }

    const doubtClearance = await DoubtClearance.findById(doubtId);
    if (!doubtClearance) {
      return res.status(404).json({ error: 'Doubt clearance not found' });
    }

    // If summary already exists, return it
    if (doubtClearance.summary) {
      return res.json({ summary: doubtClearance.summary });
    }

    // Generate summary using Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an educational assistant that creates comprehensive notes of doubt clearance sessions.
          Create a clear, structured summary of the doubt and the discussion that followed.
          Include:
          1. The original doubt/problem
          2. Key points discussed
          3. Main solutions or explanations provided
          4. Important takeaways
          
          Make it educational and easy to understand.

${MARKDOWN_WITH_FLOWCHART}`
        },
        {
          role: "user",
          content: `Doubt Title: "${doubtClearance.title}"
          Doubt Description: "${doubtClearance.description}"
          
          Chat History:
          ${doubtClearance.chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
          
          Please create a comprehensive summary of this doubt clearance session.`
        }
      ],
      model: MODELS.REASONING,
      ...GROQ_DEFAULTS,
      temperature: 0.5,
      max_tokens: 3000
    });

    const summary = completion.choices[0]?.message?.content;
    
    if (!summary) {
      throw new Error('No summary generated');
    }

    // Save summary to database
    doubtClearance.summary = summary;
    await doubtClearance.save();

    res.json({ summary });
  } catch (error) {
    console.error('Error summarizing doubt clearance:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
};

// Generate quiz for doubt clearance
const generateDoubtQuiz = async (req, res) => {
  try {
    const { doubtId, userId } = req.body;
    if (!doubtId || !userId) {
      return res.status(400).json({ error: 'Doubt ID and userId are required' });
    }

    const doubtClearance = await DoubtClearance.findOne({ _id: doubtId, userId });
    if (!doubtClearance) {
      return res.status(404).json({ error: 'Doubt clearance not found' });
    }
    if (doubtClearance.chatHistory.length < 4) {
      return res.status(400).json({ error: 'Not enough chat history to generate a quiz. Please have at least 4 conversations first.' });
    }

    const options = readQuizOptions(req.body);
    const conversation = doubtClearance.chatHistory
      .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
      .join('\n\n');

    // Placeholder questions are no longer substituted when generation fails;
    // the student gets an error and can retry instead of a meaningless quiz.
    const questions = await generateQuizQuestions({
      subject: doubtClearance.title,
      content: sampleContent(
        `Doubt: ${doubtClearance.title}\nDetails: ${doubtClearance.description}\n\n` +
        `Conversation (test what was explained here):\n${conversation}`
      ),
      options,
      model: MODELS.REASONING,
    });

    doubtClearance.quizzes.push({
      questions,
      score: null,
      totalQuestions: questions.length,
      settings: options,
      completedAt: new Date(),
    });
    await doubtClearance.save();

    res.json({ quiz: questions, quizIndex: doubtClearance.quizzes.length - 1, settings: options });
  } catch (error) {
    console.error('Error generating doubt quiz:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to generate quiz' });
  }
};

// Save quiz results
const saveDoubtQuizResults = async (req, res) => {
  try {
    const { doubtId, quizIndex, score, userId } = req.body;

    if (!doubtId || quizIndex === undefined || score === undefined || !userId) {
      return res.status(400).json({ error: 'Doubt ID, quiz index, score, and userId are required' });
    }

    const doubtClearance = await DoubtClearance.findById(doubtId);
    if (!doubtClearance) {
      return res.status(404).json({ error: 'Doubt clearance not found' });
    }

    if (doubtClearance.quizzes[quizIndex]) {
      doubtClearance.quizzes[quizIndex].score = score;
      doubtClearance.quizzes[quizIndex].completedAt = new Date();
      doubtClearance.quizzes[quizIndex].attemptedAt = new Date();
      await doubtClearance.save();
    }

    res.json({ message: 'Quiz results saved successfully' });
  } catch (error) {
    console.error('Error saving quiz results:', error);
    res.status(500).json({ error: 'Failed to save quiz results' });
  }
};

// Get YouTube video recommendations for doubt clearance
const getYouTubeRecommendations = async (req, res) => {
  try {
    const { doubtId, userId } = req.body;

    if (!doubtId || !userId) {
      return res.status(400).json({ error: 'Doubt ID and userId are required' });
    }

    const doubtClearance = await DoubtClearance.findById(doubtId);
    if (!doubtClearance) {
      return res.status(404).json({ error: 'Doubt clearance not found' });
    }

    // Check if there's enough chat history to generate recommendations
    if (doubtClearance.chatHistory.length < 4) {
      return res.status(400).json({ error: 'Not enough chat history to generate recommendations. Please have at least 4 conversations first.' });
    }

    // Use AI to generate keywords based primarily on the chat history
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that generates educational keywords for YouTube searches based on doubt clearance chat conversations.
          
          Focus PRIMARILY on the chat history content - what was actually discussed, explained, and learned during the conversation.
          The initial doubt is just context, but the chat history contains the real educational content.
          
          Return your response as a JSON array with keywords:
          ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7"]
          
          Extract keywords from:
          - Specific concepts mentioned in the chat
          - Technical terms discussed
          - Examples given during the conversation
          - Solutions or explanations provided
          - Topics that were explored in detail
          - Educational content that was shared
          
          Make keywords specific, educational, and searchable on YouTube. Prioritize content from the actual conversation over the initial doubt.`
        },
        {
          role: "user",
          content: `Initial Doubt: "${doubtClearance.title}" - ${doubtClearance.description}
          
          Chat Conversation:
          ${doubtClearance.chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')}
          
          Based on the actual conversation above, extract 6-7 educational keywords that would help find relevant YouTube videos for the topics discussed in the chat.`
        }
      ],
      model: MODELS.REASONING,
      ...GROQ_DEFAULTS,
      temperature: 0.7,
      max_tokens: 400
    });

    const aiResponse = completion.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from Groq AI');
    }

    // Parse keywords
    let keywords;
    try {
      keywords = parseModelJson(aiResponse, { context: 'search keywords' });
      if (!Array.isArray(keywords) || keywords.length === 0) {
        // Fallback to doubt title if parsing fails
        keywords = [doubtClearance.title];
      }
    } catch (parseError) {
      console.error('Error parsing keywords:', parseError);
      keywords = [doubtClearance.title];
    }

    // Create search queries by combining keywords from chat discussion
    const searchQueries = [];
    
    // Single keyword searches (prioritize most relevant from chat)
    keywords.slice(0, 4).forEach(keyword => {
      searchQueries.push(keyword);
    });
    
    // Two keyword combinations from chat discussion
    if (keywords.length >= 2) {
      searchQueries.push(`${keywords[0]} ${keywords[1]}`);
    }
    if (keywords.length >= 3) {
      searchQueries.push(`${keywords[1]} ${keywords[2]}`);
    }
    if (keywords.length >= 4) {
      searchQueries.push(`${keywords[2]} ${keywords[3]}`);
    }
    
    // Three keyword combination for more specific results
    if (keywords.length >= 3) {
      searchQueries.push(`${keywords[0]} ${keywords[1]} ${keywords[2]}`);
    }
    if (keywords.length >= 4) {
      searchQueries.push(`${keywords[1]} ${keywords[2]} ${keywords[3]}`);
    }
    
    // Add educational context to some queries
    if (keywords.length >= 2) {
      searchQueries.push(`${keywords[0]} tutorial`);
      searchQueries.push(`${keywords[1]} explanation`);
    }

    console.log('Generated keywords:', keywords);
    console.log('Search queries:', searchQueries);

    // Search YouTube for each query and collect videos
    const allVideos = [];
    for (const query of searchQueries) {
      try {
        const videos = await searchYouTubeVideos(query, 2); // Get 2 videos per query
        allVideos.push(...videos);
      } catch (error) {
        console.error(`Error searching for "${query}":`, error);
      }
    }

    // Remove duplicates based on video URL
    const uniqueVideos = allVideos.filter((video, index, self) => 
      index === self.findIndex(v => v.url === video.url)
    );

    // Limit to 6 videos maximum
    const recommendations = uniqueVideos.slice(0, 6);

    // If no videos found, return empty array
    if (recommendations.length === 0) {
      return res.json({ 
        recommendations: [],
        message: "No relevant videos found. Try having more conversations about your doubt to get better recommendations."
      });
    }

    // Save recommendations to database
    doubtClearance.youtubeRecommendations = recommendations.map(rec => ({
      ...rec,
      suggestedAt: new Date()
    }));
    await doubtClearance.save();

    res.json({ recommendations });
  } catch (error) {
    console.error('Error getting YouTube recommendations:', error);
    res.status(500).json({ error: 'Failed to get YouTube recommendations' });
  }
};

module.exports = {
  createDoubt,
  getUserDoubtClearances,
  createDoubtClearance,
  deleteDoubtClearance,
  chatWithDoubtClearance,
  summarizeDoubtClearance,
  generateDoubtQuiz,
  saveDoubtQuizResults,
  getYouTubeRecommendations
};
