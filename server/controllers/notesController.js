const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const Groq = require('groq-sdk');
const Notes = require('../models/notes');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');
const { parseModelJson } = require('../utils/parseModelJson');
const { MARKDOWN_WITH_FLOWCHART } = require('../config/prompts');
const { readQuizOptions, generateQuiz: generateQuizQuestions, sampleContent } = require('../services/quizService');

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

    // Extract text from PDF.
    //
    // pdf-parse v1 bundled a 2018 build of pdf.js that threw "bad XRef entry"
    // on ordinary modern PDFs (anything LibreOffice or Word produces), so
    // uploads failed for most real files. v2 uses a current pdf.js.
    const pdfBuffer = fs.readFileSync(req.file.path);
    let extractedText = '';
    let parser;
    try {
      parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
      const pdfData = await parser.getText();
      extractedText = (pdfData.text || '').trim();
    } catch (pdfError) {
      console.error('PDF extraction failed:', pdfError);
      fs.unlink(req.file.path, () => {});
      return res.status(422).json({
        error: 'Could not read text from that PDF. If it is a scanned document it has no text layer to extract.',
      });
    } finally {
      if (parser && typeof parser.destroy === 'function') {
        await parser.destroy().catch(() => {});
      }
    }

    if (!extractedText) {
      fs.unlink(req.file.path, () => {});
      return res.status(422).json({
        error: 'That PDF contains no extractable text (it is most likely a scan or images only).',
      });
    }

    // Save to database
    const note = new Notes({
      userId,
      title: title || req.file.originalname,
      fileName: req.file.originalname,
      filePath: req.file.path,
      extractedText
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

0. Never emit raw HTML. Do not use <br> for line breaks - start a new line or list item. HTML tags are displayed to the user as literal text.

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
- Answer in depth: explain the concept, why it works that way, and how it is applied,
  with a concrete example or code snippet where one helps. Prefer a complete answer
  over a short one, but do not pad it with repetition
- If asked about something not in the notes, politely explain that the information is not available in the provided notes
- Maintain a helpful and educational tone`;

    // Clean chatHistory to remove MongoDB _id fields and ensure proper format.
    // chatHistory is optional in the request body, so it must not be assumed
    // to be an array - an omitted field used to throw and return a 500.
    const cleanedChatHistory = (Array.isArray(chatHistory) ? chatHistory : [])
      .slice(-5)
      .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant') && msg.content)
      .map((msg) => ({ role: msg.role, content: msg.content }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...cleanedChatHistory, // Use cleaned chat history
      { role: 'user', content: message }
    ];

    const completion = await groq.chat.completions.create({
      messages: messages,
      model: MODELS.FAST,
      ...GROQ_DEFAULTS,
      max_tokens: 2500,
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
1. Cover every topic in the notes, each under its own heading - do not merge or skip any
2. For each topic: explain the concept, the detail behind it, and why it matters
3. Preserve specifics from the notes (names, numbers, commands, distinctions) rather than generalising them
4. Expand on terms the notes only mention in passing, so the summary stands on its own

${MARKDOWN_WITH_FLOWCHART}

Notes content:
${noteText}`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Please summarize these notes comprehensively.' }
        ],
        model: MODELS.FAST,
        ...GROQ_DEFAULTS,
        max_tokens: 3000,
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
        const chunkPrompt = `Summarise the following text section in detail. Keep every distinct topic, definition, example, number and distinction it contains - this summary will be merged with others, so anything dropped here is lost for good:

${chunks[i]}`;

        const completion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a helpful assistant that creates detailed, faithful summaries that preserve specifics.' },
            { role: 'user', content: chunkPrompt }
          ],
          model: MODELS.FAST,
          ...GROQ_DEFAULTS,
          max_tokens: 900,
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
        model: MODELS.FAST,
        ...GROQ_DEFAULTS,
        max_tokens: 3000,
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

    const note = await Notes.findById(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const options = readQuizOptions(req.body);
    // The whole document is sampled evenly; the old version quizzed only on
    // the first chunk, so later pages of long notes were never tested.
    const questions = await generateQuizQuestions({
      subject: note.title,
      content: sampleContent(note.extractedText),
      options,
    });

    const quizId = Date.now().toString();
    note.quizzes.push({ quizId, questions, settings: options, createdAt: new Date() });
    note.lastAccessed = new Date();
    await note.save();

    res.json({ quiz: questions, quizId, noteId, settings: options });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error generating quiz' });
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
    note.quizzes[quizIndex].attemptedAt = new Date();
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
