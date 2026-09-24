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
const { converse } = require('../ai/conversation');

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
    const { noteId, message } = req.body;
    const question = String(message || '').trim();
    if (!noteId || !question) {
      return res.status(400).json({ error: 'Note ID and message are required' });
    }

    const note = await Notes.findById(noteId).select('title extractedText chatHistory userId');
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Ground the answer in the note. Short notes go in whole; long ones contribute
    // the chunks that best match this question *and* the student's recent
    // questions, so a follow-up like "explain that more" still finds the passage.
    const recentQuestions = (note.chatHistory || []).filter((m) => m.role === 'user').slice(-2).map((m) => m.content);
    const context = relevantNoteText(note.extractedText, [question, ...recentQuestions].join(' '));

    const system = `You are a patient tutor helping a student understand their own notes, titled "${note.title}".
Answer from the notes below. If something is not covered by the notes, say so plainly, then give a brief general explanation marked as coming from outside the notes.

NOTES:
${context}

How to answer:
- Match the length to the question: a quick question gets a short, direct answer; "explain" or "compare" gets more.
- Use GitHub-flavoured Markdown: ### headings only for longer answers, lists for steps and key points, fenced code blocks with a language tag for code.
- Quote or point to the relevant part of the notes when it helps.
- Never emit raw HTML.`;

    const text = await converse({
      Model: Notes,
      filter: { _id: note._id },
      field: 'chatHistory',
      timeKey: 'timestamp',
      system,
      input: question,
      tier: 'FAST',
      maxTokens: 2500,
      temperature: 0.5,
    });
    await Notes.updateOne({ _id: note._id }, { $set: { lastAccessed: new Date() } });

    res.json({ response: text, noteId });
  } catch (error) {
    console.error('Error in chat with notes:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Error processing chat request' });
  }
};

/** Up to ~16k characters of the note: all of it if it fits, otherwise the best-matching chunks in document order. */
function relevantNoteText(fullText, query, budget = 16000) {
  const text = String(fullText || '');
  if (text.length <= budget) return text;
  const chunks = chunkText(text, 1200);
  const words = String(query).toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const scored = chunks.map((chunk, index) => {
    const lower = chunk.toLowerCase();
    return { index, chunk, score: words.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0) };
  });
  const picked = [];
  let used = 0;
  for (const c of [...scored].sort((a, b) => b.score - a.score || a.index - b.index)) {
    if (used + c.chunk.length > budget) continue;
    picked.push(c);
    used += c.chunk.length;
  }
  return picked.sort((a, b) => a.index - b.index).map((c) => c.chunk).join('\n...\n');
}

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
