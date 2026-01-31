const DoubtClearance = require('../models/doubtClearance');
const Groq = require('groq-sdk');
const youtubesearchapi = require('youtube-search-api');

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

// Create a new doubt clearance
const createDoubtClearance = async (req, res) => {
  try {
    const { title, description, imageUrl, userId } = req.body;

    if (!title || !description || !userId) {
      return res.status(400).json({ error: 'Title, description, and userId are required' });
    }

    const doubtClearance = new DoubtClearance({
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl || null,
      userId,
      chatHistory: [],
      summary: '',
      quizzes: [],
      youtubeRecommendations: []
    });

    const savedDoubtClearance = await doubtClearance.save();
    res.status(201).json(savedDoubtClearance);
  } catch (error) {
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

    if (!doubtId || !message || !userId) {
      return res.status(400).json({ error: 'Doubt ID, message, and userId are required' });
    }

    const doubtClearance = await DoubtClearance.findById(doubtId);
    if (!doubtClearance) {
      return res.status(404).json({ error: 'Doubt clearance not found' });
    }

    // Add user message to chat history
    const userMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    };

    doubtClearance.chatHistory.push(userMessage);

    // Generate AI response using Groq with structured output formatting
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful educational assistant that helps students clear their doubts. 
          The student has a doubt with the following details:
          Title: "${doubtClearance.title}"
          Description: "${doubtClearance.description}"
          
          IMPORTANT - Format your response using these markdown elements for professional display:
          
          1. Use ### for section headers (e.g., "### Understanding the Concept")
          2. Use numbered lists (1. 2. 3.) for step-by-step explanations
          3. Use bullet points (- or *) for key points or features
          4. Use code blocks with language tags for code examples:
             \`\`\`javascript
             // code here
             \`\`\`
          5. Use emoji indicators for special notes:
             ℹ️ for informational content
             💡 for helpful tips
             ⚠️ for warnings or cautions
             ✅ for confirmations or best practices
             ❌ for common mistakes to avoid
          
          RESPONSE STRUCTURE:
          - Start with a brief greeting or acknowledgment
          - Use ### headers to organize different sections
          - Include code examples in proper code blocks when relevant
          - Use numbered lists for sequential steps
          - Use bullet points for related concepts
          - Add emoji-prefixed notes for emphasis
          - End with encouragement
          
          Be clear, educational, and provide practical examples. Break complex topics into digestible sections.`
        },
        ...doubtClearance.chatHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1500
    });

    const aiResponse = completion.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from Groq AI');
    }

    // Add AI response to chat history
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date()
    };

    doubtClearance.chatHistory.push(assistantMessage);
    await doubtClearance.save();

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error chatting with doubt clearance:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
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
          
          Make it educational and easy to understand.`
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
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 1500
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

    const doubtClearance = await DoubtClearance.findById(doubtId);
    if (!doubtClearance) {
      return res.status(404).json({ error: 'Doubt clearance not found' });
    }

    // Check if there's enough chat history to generate a quiz
    if (doubtClearance.chatHistory.length < 4) {
      return res.status(400).json({ error: 'Not enough chat history to generate a quiz. Please have at least 4 conversations first.' });
    }

    // Generate quiz using Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an expert educational quiz generator that creates questions based on actual conversation content.

          CRITICAL: Generate quiz questions ONLY based on the specific concepts, solutions, and information discussed in the chat history. Do NOT use generic questions.

          Analyze the chat conversation thoroughly and create AT LEAST 8 quiz questions that test understanding of:
          - Specific concepts explained during the conversation
          - Solutions provided in the chat
          - Examples given by the assistant
          - Technical details discussed
          - Key insights shared
          - Step-by-step processes mentioned
          - Important facts or data shared
          - Problem-solving approaches discussed

          Return your response as a JSON array with this exact format:
          [
            {
              "question": "Specific question based on chat content",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctAnswer": 0,
              "explanation": "Why this answer is correct based on the conversation"
            }
          ]

          Requirements:
          - Generate MINIMUM 8 questions, preferably 10-12 if the conversation is rich
          - Questions MUST be based on actual conversation content
          - Reference specific information shared in the chat
          - Options should be realistic and test real understanding
          - correctAnswer is the index (0-3) of the correct option
          - Explanations should reference the conversation content
          - Focus on the most important concepts discussed
          - Cover different aspects of the conversation (technical details, examples, solutions, etc.)`
        },
        {
          role: "user",
          content: `CHAT CONVERSATION TO ANALYZE FOR QUIZ GENERATION:

          Doubt Title: "${doubtClearance.title}"
          Doubt Description: "${doubtClearance.description}"
          
          FULL CHAT HISTORY (This is the ONLY source for quiz questions):
          ${doubtClearance.chatHistory.map((msg, index) => `Message ${index + 1} (${msg.role}): ${msg.content}`).join('\n\n')}
          
          INSTRUCTIONS:
          - Analyze the ENTIRE conversation above thoroughly
          - Extract specific concepts, solutions, examples, and information discussed
          - Generate AT LEAST 8 quiz questions based on the actual content
          - Each question should test understanding of specific information shared in the chat
          - Make questions progressively challenging (basic to advanced concepts)
          - Cover different aspects: technical details, examples, step-by-step processes, key insights
          - Ensure each question references actual content from the conversation
          - Generate 10-12 questions if the conversation is rich with content`
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 3000
    });

    const aiResponse = completion.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from Groq AI');
    }

    // Parse the AI response
    let quiz;
    try {
      // Clean the response by removing markdown code blocks
      let cleanedResponse = aiResponse.trim();
      
      // Remove ```json and ``` markers if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to extract JSON from the response if it's wrapped in other text
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      console.log('Cleaned quiz response:', cleanedResponse);
      quiz = JSON.parse(cleanedResponse);
      
      // Validate quiz structure
      if (!Array.isArray(quiz) || quiz.length === 0) {
        throw new Error('Invalid quiz format');
      }
    } catch (parseError) {
      console.error('Error parsing quiz response:', parseError);
      console.log('Raw AI response:', aiResponse);
      
      // Create a more dynamic fallback quiz based on chat content
      const chatContent = doubtClearance.chatHistory.map(msg => msg.content).join(' ');
      const hasTechnicalContent = chatContent.toLowerCase().includes('code') || 
                                 chatContent.toLowerCase().includes('function') || 
                                 chatContent.toLowerCase().includes('algorithm') ||
                                 chatContent.toLowerCase().includes('programming') ||
                                 chatContent.toLowerCase().includes('software');
      
      const userMessages = doubtClearance.chatHistory.filter(msg => msg.role === 'user');
      const assistantMessages = doubtClearance.chatHistory.filter(msg => msg.role === 'assistant');
      
      quiz = [
        {
          question: `What was the main topic of "${doubtClearance.title}"?`,
          options: [doubtClearance.title, "General question", "Technical issue", "Personal problem"],
          correctAnswer: 0,
          explanation: `The main topic was "${doubtClearance.title}" as stated in the doubt.`
        },
        {
          question: "How many messages were exchanged in this conversation?",
          options: [
            `${doubtClearance.chatHistory.length} messages`,
            "Less than 4 messages", 
            "More than 10 messages", 
            "Only 1 message"
          ],
          correctAnswer: 0,
          explanation: `The conversation had ${doubtClearance.chatHistory.length} messages in total.`
        },
        {
          question: "How many questions did the user ask?",
          options: [
            `${userMessages.length} questions`,
            "Less than 2 questions",
            "More than 5 questions", 
            "No questions asked"
          ],
          correctAnswer: 0,
          explanation: `The user asked ${userMessages.length} questions during the conversation.`
        },
        {
          question: "How many responses did the assistant provide?",
          options: [
            `${assistantMessages.length} responses`,
            "Less than 2 responses",
            "More than 5 responses", 
            "No responses provided"
          ],
          correctAnswer: 0,
          explanation: `The assistant provided ${assistantMessages.length} responses during the conversation.`
        }
      ];
      
      // Add technical questions if the conversation seems technical
      if (hasTechnicalContent) {
        quiz.push(
          {
            question: "Was this conversation about a technical topic?",
            options: ["Yes, it involved technical concepts", "No, it was general", "Maybe", "Not sure"],
            correctAnswer: 0,
            explanation: "The conversation contained technical terms and concepts based on the chat content."
          },
          {
            question: "What type of technical content was discussed?",
            options: ["Programming/Code", "General technology", "Hardware", "Not technical"],
            correctAnswer: 0,
            explanation: "The conversation contained programming and code-related terms."
          }
        );
      }
      
      // Add questions based on conversation length
      if (doubtClearance.chatHistory.length >= 6) {
        quiz.push({
          question: "Was this a detailed conversation?",
          options: ["Yes, it was extensive", "No, it was brief", "Moderate length", "Very short"],
          correctAnswer: 0,
          explanation: `With ${doubtClearance.chatHistory.length} messages, this was a detailed conversation.`
        });
      }
      
      // Add questions based on content analysis
      const hasQuestions = chatContent.includes('?');
      const hasExamples = chatContent.toLowerCase().includes('example') || chatContent.toLowerCase().includes('for instance');
      
      if (hasQuestions) {
        quiz.push({
          question: "Did the user ask specific questions in the conversation?",
          options: ["Yes, multiple questions were asked", "No questions", "Only one question", "Not sure"],
          correctAnswer: 0,
          explanation: "The conversation contained question marks, indicating specific questions were asked."
        });
      }
      
      if (hasExamples) {
        quiz.push({
          question: "Were examples provided in the conversation?",
          options: ["Yes, examples were given", "No examples", "Maybe", "Not clear"],
          correctAnswer: 0,
          explanation: "The conversation contained words like 'example' or 'for instance', indicating examples were provided."
        });
      }
    }

    // Save quiz to database
    const newQuiz = {
      questions: quiz,
      score: null,
      totalQuestions: quiz.length,
      completedAt: new Date()
    };

    doubtClearance.quizzes.push(newQuiz);
    await doubtClearance.save();

    res.json({ quiz });
  } catch (error) {
    console.error('Error generating doubt quiz:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
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
      model: "llama-3.3-70b-versatile",
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
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        keywords = JSON.parse(jsonMatch[0]);
      } else {
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
  getUserDoubtClearances,
  createDoubtClearance,
  deleteDoubtClearance,
  chatWithDoubtClearance,
  summarizeDoubtClearance,
  generateDoubtQuiz,
  saveDoubtQuizResults,
  getYouTubeRecommendations
};
