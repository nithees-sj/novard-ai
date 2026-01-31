const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const Groq = require('groq-sdk');
const Notes = require('../models/notes');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/notes';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Initialize Groq AI
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Helper function to chunk text into smaller parts
const chunkText = (text, maxTokens = 2000) => {
  const words = text.split(' ');
  const chunks = [];
  let currentChunk = '';
  
  for (const word of words) {
    const testChunk = currentChunk + (currentChunk ? ' ' : '') + word;
    // Rough estimate: 1 token ≈ 0.75 words
    if ((testChunk.split(' ').length * 0.75) > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk = testChunk;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

// Upload and process PDF notes
const uploadNotes = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { title } = req.body;
    const userId = req.body.userId || 'default-user'; // You can get this from auth middleware

    // Extract text from PDF
    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(pdfBuffer);

    // Save to database
    const note = new Notes({
      userId,
      title: title || req.file.originalname,
      fileName: req.file.originalname,
      filePath: req.file.path,
      extractedText: pdfData.text
    });

    await note.save();

    // Clean up the file if needed (optional)
    // fs.unlinkSync(req.file.path);

    res.json({
      id: note._id,
      title: note.title,
      fileName: note.fileName,
      uploadedAt: note.uploadedAt,
      message: 'Notes uploaded and processed successfully'
    });

  } catch (error) {
    console.error('Error uploading notes:', error);
    res.status(500).json({ error: 'Error processing PDF file' });
  }
};

// Chat with notes
const chatWithNotes = async (req, res) => {
  try {
    const { noteId, message, chatHistory } = req.body;

    if (!noteId || !message) {
      return res.status(400).json({ error: 'Note ID and message are required' });
    }

    // Get the note from database
    const note = await Notes.findById(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check if the note content is too large and chunk if necessary
    const noteText = note.extractedText;
    const chunks = chunkText(noteText, 1500); // Use smaller chunks for chat
    
    let relevantChunk = noteText;
    
    // If we have multiple chunks, try to find the most relevant one based on the user's question
    if (chunks.length > 1) {
      // Simple keyword matching to find relevant chunk
      const questionWords = message.toLowerCase().split(' ');
      let bestChunk = chunks[0];
      let maxMatches = 0;
      
      for (const chunk of chunks) {
        const chunkWords = chunk.toLowerCase().split(' ');
        const matches = questionWords.filter(word => 
          word.length > 3 && chunkWords.some(chunkWord => chunkWord.includes(word))
        ).length;
        
        if (matches > maxMatches) {
          maxMatches = matches;
          bestChunk = chunk;
        }
      }
      
      relevantChunk = bestChunk;
    }

    const systemPrompt = `You are a helpful assistant that answers questions based on the provided notes. Use only the information from the notes to answer questions. If the question cannot be answered based on the notes, say so.

Notes content:
${relevantChunk}

IMPORTANT - Format your response using these markdown elements for professional display:

1. Use ### for section headers (e.g., "### Key Concept")
2. Use numbered lists (1. 2. 3.) for step-by-step explanations
3. Use bullet points (- or *) for key points or features
4. Use code blocks with language tags for code examples:
   \`\`\`language
   // code here
   \`\`\`
5. Use emoji indicators for special notes:
   ℹ️ for informational content
   💡 for helpful tips
   ⚠️ for warnings or cautions
   ✅ for confirmations or best practices
   ❌ for common mistakes to avoid

RESPONSE STRUCTURE:
- Start with a brief acknowledgment
- Use ### headers to organize different sections
- Include code examples in proper code blocks when relevant
- Use numbered lists for sequential information
- Use bullet points for related concepts
- Add emoji-prefixed notes for emphasis
- Be concise but comprehensive
- If asked about something not in the notes, politely explain that the information is not available in the provided notes
- Maintain a helpful and educational tone`;

    // Clean chatHistory to remove MongoDB _id fields and ensure proper format
    const cleanedChatHistory = chatHistory.slice(-5).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...cleanedChatHistory, // Use cleaned chat history
      { role: 'user', content: message }
    ];

    const completion = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.1-8b-instant",
      max_tokens: 800, // Reduced to stay within limits
      temperature: 0.7
    });

    const text = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    // Save chat message to database
    if (note) {
      note.chatHistory.push({
        role: 'user',
        content: message
      });
      note.chatHistory.push({
        role: 'assistant',
        content: text
      });
      note.lastAccessed = new Date();
      await note.save();
    }

    res.json({
      response: text,
      noteId: noteId
    });

  } catch (error) {
    console.error('Error in chat with notes:', error);
    res.status(500).json({ error: 'Error processing chat request' });
  }
};

// Summarize notes
const summarizeNotes = async (req, res) => {
  try {
    const { noteId } = req.body;

    if (!noteId) {
      return res.status(400).json({ error: 'Note ID is required' });
    }

    // Get the note from database
    const note = await Notes.findById(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Handle large texts by chunking
    const noteText = note.extractedText;
    const chunks = chunkText(noteText, 1800); // Slightly larger chunks for summarization
    
    if (chunks.length === 1) {
      // Single chunk - process normally
      const systemPrompt = `Please provide a comprehensive summary of the following notes. The summary should:
1. Highlight the main topics and key concepts
2. Include important details and supporting information
3. Be well-structured and easy to read
4. Capture the essential information from the notes

Notes content:
${noteText}`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Please summarize these notes comprehensively.' }
        ],
        model: "llama-3.1-8b-instant",
        max_tokens: 1200,
        temperature: 0.5
      });

      const summary = completion.choices[0]?.message?.content || "Unable to generate summary.";
      
      // Save summary to database
      note.summary = summary;
      note.lastAccessed = new Date();
      await note.save();
      
      res.json({
        summary: summary,
        noteId: noteId
      });
    } else {
      // Multiple chunks - summarize each chunk then combine
      const chunkSummaries = [];
      
      for (let i = 0; i < Math.min(chunks.length, 3); i++) { // Limit to 3 chunks to avoid token limits
        const chunkPrompt = `Please provide a concise summary of the following text section. Focus on the main points:

${chunks[i]}`;

        const completion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a helpful assistant that creates concise summaries.' },
            { role: 'user', content: chunkPrompt }
          ],
          model: "llama-3.1-8b-instant",
          max_tokens: 400,
          temperature: 0.5
        });

        chunkSummaries.push(completion.choices[0]?.message?.content || "Unable to summarize this section.");
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Combine chunk summaries
      const combinedSummary = chunkSummaries.join('\n\n');
      const finalPrompt = `Please create a comprehensive summary from these partial summaries:

${combinedSummary}

Combine them into a well-structured, comprehensive summary.`;

      const finalCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a helpful assistant that creates comprehensive summaries.' },
          { role: 'user', content: finalPrompt }
        ],
        model: "llama-3.1-8b-instant",
        max_tokens: 800,
        temperature: 0.5
      });

      const summary = finalCompletion.choices[0]?.message?.content || "Unable to generate comprehensive summary.";
      
      // Save summary to database
      note.summary = summary;
      note.lastAccessed = new Date();
      await note.save();
      
      res.json({
        summary: summary,
        noteId: noteId
      });
    }

  } catch (error) {
    console.error('Error summarizing notes:', error);
    res.status(500).json({ error: 'Error generating summary' });
  }
};

// Generate quiz from notes
const generateQuiz = async (req, res) => {
  try {
    const { noteId } = req.body;

    if (!noteId) {
      return res.status(400).json({ error: 'Note ID is required' });
    }

    // Get the note from database
    const note = await Notes.findById(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Handle large texts by chunking for quiz generation
    const noteText = note.extractedText;
    const chunks = chunkText(noteText, 1600); // Smaller chunks for quiz generation
    
    if (chunks.length === 1) {
      // Single chunk - process normally
      const systemPrompt = `Based on the following notes, generate a quiz with 5-7 questions. Each question should:
1. Test understanding of key concepts from the notes
2. Have 4 multiple choice options (A, B, C, D)
3. Include the correct answer
4. Cover different aspects of the content

Return the quiz in the following JSON format:
[
  {
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Correct option letter"
  }
]

Notes content:
${noteText}`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate a comprehensive quiz based on these notes.' }
        ],
        model: "llama-3.1-8b-instant",
        max_tokens: 1500,
        temperature: 0.7
      });

      const quizText = completion.choices[0]?.message?.content || "Unable to generate quiz.";
      
      try {
        // Clean up the response to extract JSON
        let jsonMatch = quizText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          jsonMatch = quizText.match(/\{[\s\S]*\}/);
        }
        
        const quiz = JSON.parse(jsonMatch ? jsonMatch[0] : quizText);
        const quizData = Array.isArray(quiz) ? quiz : [quiz];
        
        // Save quiz to database
        const quizId = Date.now().toString();
        note.quizzes.push({
          quizId: quizId,
          questions: quizData,
          createdAt: new Date()
        });
        note.lastAccessed = new Date();
        await note.save();
        
        res.json({
          quiz: quizData,
          quizId: quizId,
          noteId: noteId
        });
      } catch (parseError) {
        console.error('Error parsing quiz JSON:', parseError);
        const fallbackQuiz = [
          {
            question: "Based on the notes, what is the main topic discussed?",
            options: ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: "A"
          }
        ];
        
        res.json({
          quiz: fallbackQuiz,
          noteId: noteId,
          warning: "Quiz generation had formatting issues, showing sample question"
        });
      }
    } else {
      // Multiple chunks - generate quiz from first chunk only to avoid token limits
      const firstChunk = chunks[0];
      const systemPrompt = `Based on the following notes section, generate a quiz with 5-6 questions. Each question should:
1. Test understanding of key concepts from the notes
2. Have 4 multiple choice options (A, B, C, D)
3. Include the correct answer
4. Cover different aspects of the content

Return the quiz in the following JSON format:
[
  {
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Correct option letter"
  }
]

Notes content:
${firstChunk}`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate a quiz based on this section of notes.' }
        ],
        model: "llama-3.1-8b-instant",
        max_tokens: 1200,
        temperature: 0.7
      });

      const quizText = completion.choices[0]?.message?.content || "Unable to generate quiz.";

      try {
        // Clean up the response to extract JSON
        let jsonMatch = quizText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          jsonMatch = quizText.match(/\{[\s\S]*\}/);
        }
        
        const quiz = JSON.parse(jsonMatch ? jsonMatch[0] : quizText);
        const quizData = Array.isArray(quiz) ? quiz : [quiz];
        
        // Save quiz to database
        const quizId = Date.now().toString();
        note.quizzes.push({
          quizId: quizId,
          questions: quizData,
          createdAt: new Date()
        });
        note.lastAccessed = new Date();
        await note.save();
        
        res.json({
          quiz: quizData,
          quizId: quizId,
          noteId: noteId,
          warning: "Quiz generated from first section of notes only"
        });
      } catch (parseError) {
        console.error('Error parsing quiz JSON:', parseError);
        const fallbackQuiz = [
          {
            question: "Based on the notes, what is the main topic discussed?",
            options: ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: "A"
          }
        ];
        
        // Save fallback quiz to database
        const quizId = Date.now().toString();
        note.quizzes.push({
          quizId: quizId,
          questions: fallbackQuiz,
          createdAt: new Date()
        });
        note.lastAccessed = new Date();
        await note.save();
        
        res.json({
          quiz: fallbackQuiz,
          quizId: quizId,
          noteId: noteId,
          warning: "Quiz generation had formatting issues, showing sample question"
        });
      }
    }

  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ error: 'Error generating quiz' });
  }
};

// Get user's notes
const getUserNotes = async (req, res) => {
  try {
    const userId = req.params.userId || 'default-user';
    
    const notes = await Notes.find({ userId }).sort({ lastAccessed: -1 });
    
    res.json(notes.map(note => ({
      _id: note._id,
      id: note._id,
      title: note.title,
      fileName: note.fileName,
      summary: note.summary || '',
      chatHistory: note.chatHistory || [],
      quizzes: note.quizzes || [],
      uploadedAt: note.uploadedAt,
      lastAccessed: note.lastAccessed
    })));

  } catch (error) {
    console.error('Error fetching user notes:', error);
    res.status(500).json({ error: 'Error fetching notes' });
  }
};

// Delete note
const deleteNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    
    const note = await Notes.findById(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Delete the file if it exists
    if (fs.existsSync(note.filePath)) {
      fs.unlinkSync(note.filePath);
    }

    await Notes.findByIdAndDelete(noteId);
    
    res.json({ message: 'Note deleted successfully' });

  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Error deleting note' });
  }
};

// Save quiz results
const saveQuizResults = async (req, res) => {
  try {
    const { noteId, quizId, userAnswers, score } = req.body;

    if (!noteId || !quizId || !userAnswers || !score) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const note = await Notes.findById(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const quizIndex = note.quizzes.findIndex(quiz => quiz.quizId === quizId);
    if (quizIndex === -1) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    note.quizzes[quizIndex].userAnswers = userAnswers;
    note.quizzes[quizIndex].score = score;
    note.lastAccessed = new Date();

    await note.save();

    res.json({ success: true, message: 'Quiz results saved successfully' });

  } catch (error) {
    console.error('Error saving quiz results:', error);
    res.status(500).json({ error: 'Error saving quiz results' });
  }
};

module.exports = {
  upload,
  uploadNotes,
  chatWithNotes,
  summarizeNotes,
  generateQuiz,
  getUserNotes,
  deleteNote,
  saveQuizResults
};
