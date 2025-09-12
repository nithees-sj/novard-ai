const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Generate AI comment for a new issue
const generateAICommentForIssue = async (issue) => {
  try {
    console.log('Generating AI comment for issue:', issue.title);
    
    const prompt = `A user has created a new forum issue with the title "${issue.title}" and description "${issue.description}". 
    As an AI assistant, provide a helpful initial response to welcome them and offer some initial thoughts or suggestions. 
    Keep it conversational and helpful, around 2-3 sentences. Be specific to their issue and provide actionable advice if possible.`;

    console.log('AI Prompt for issue:', prompt);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a helpful AI assistant in a tech forum. You provide constructive, specific, and actionable advice to users' technical questions and issues. Always be encouraging and professional." 
        },
        { role: "user", content: prompt },
      ],
      model: "gemma2-9b-it",
      temperature: 0.7,
      max_tokens: 200,
      top_p: 1,
      stream: false,
    });

    const response = chatCompletion.choices[0]?.message?.content || "";
    console.log('AI Response for issue:', response);
    return response.trim() || "Thank you for sharing this issue! I'll do my best to help you find a solution.";
  } catch (error) {
    console.error('Error generating AI comment for issue:', error);
    return "Thank you for sharing this issue! I'll do my best to help you find a solution.";
  }
};

// Generate AI response to a user comment
const generateAIResponseToComment = async (userComment, issue) => {
  try {
    console.log('Generating AI response to comment:', userComment.content);
    
    // Get recent comments to understand the conversation context
    const ForumComment = require('../models/forumComment');
    const recentComments = await ForumComment.find({ 
      issueId: issue.issueId 
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .exec();

    // Build conversation context
    const conversationContext = recentComments
      .reverse()
      .map(comment => `${comment.userName}: ${comment.content}`)
      .join('\n');

    const prompt = `You are an AI assistant in a tech forum. Here's the context:

ISSUE TITLE: "${issue.title}"
ISSUE DESCRIPTION: "${issue.description}"

RECENT CONVERSATION:
${conversationContext}

The user "${userComment.userName}" (${userComment.userEmail}) just commented: "${userComment.content}"

As an AI assistant, provide a helpful response that:
1. Acknowledges what ${userComment.userName} said specifically
2. Builds on the conversation context
3. Provides actionable advice or insights
4. Is conversational and encouraging
5. Addresses their specific point or question

Keep it 2-4 sentences and be specific to their comment and the overall discussion.`;

    console.log('AI Prompt for comment:', prompt);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a helpful AI assistant in a tech forum. You provide constructive, specific, and actionable advice to users' technical questions and issues. Always be encouraging and professional. When responding to comments, acknowledge what the user said and add valuable insights based on the conversation context." 
        },
        { role: "user", content: prompt },
      ],
      model: "gemma2-9b-it",
      temperature: 0.7,
      max_tokens: 400,
      top_p: 1,
      stream: false,
    });

    const response = chatCompletion.choices[0]?.message?.content || "";
    console.log('AI Response to comment:', response);
    return response.trim() || "That's a great point! Let me add some additional thoughts to help with this discussion.";
  } catch (error) {
    console.error('Error generating AI response to comment:', error);
    return "That's a great point! Let me add some additional thoughts to help with this discussion.";
  }
};

// Generate AI response for general forum discussion
const generateAIForumResponse = async (prompt) => {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a helpful AI assistant in a tech forum. You provide constructive, specific, and actionable advice to users' technical questions and issues. Always be encouraging and professional. Keep responses concise but helpful." 
        },
        { role: "user", content: prompt },
      ],
      model: "gemma2-9b-it",
      temperature: 0.7,
      max_tokens: 300,
      top_p: 1,
      stream: false,
    });

    const response = chatCompletion.choices[0]?.message?.content || "";
    return response.trim();
  } catch (error) {
    console.error('Error generating AI forum response:', error);
    return "I'm here to help! Could you please provide more details about your question?";
  }
};

module.exports = {
  generateAICommentForIssue,
  generateAIResponseToComment,
  generateAIForumResponse
};
