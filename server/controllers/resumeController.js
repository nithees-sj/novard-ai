const Resume = require('../models/resumes');
const Groq = require('groq-sdk');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

exports.processResumePrompt = async (req, res) => {
  const { career } = req.body;
  console.log(req.body);

  try {
    const prompt = `Create a professional, ATS-friendly resume template tailored for a ${career} engineer.

Use a ### heading per section: Header, Professional Summary, Skills, Work
Experience, Projects, Education, Certifications, and Additional Sections.

For every section give:
- **What to include** - the specific fields and their order
- **How to phrase it** - the wording pattern that works, with a filled-in example line written as a placeholder (e.g. "Reduced API p95 latency by 40% by adding a Redis cache layer")
- **What ATS parsers expect** - formatting that survives automated screening
- **Common mistakes** - what gets this section rejected

Close with a ### Formatting checklist covering length, fonts, margins, file
format and file naming.

Use placeholders rather than invented personal details. Be specific about
phrasing and structure rather than giving generic advice.
Return GitHub-flavoured Markdown. Never emit raw HTML.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      model: MODELS.REASONING,
      ...GROQ_DEFAULTS,
      temperature: 0.5,
      max_tokens: 4500,
      top_p: 1,
      stream: false,
    });

    const content = chatCompletion.choices[0]?.message?.content || "";

    const markdownResume = content.trim();

    const existingResume = await Resume.findOneAndUpdate(
      { careerId: career },
      { $set: { resume: markdownResume } },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: 'Resume prompt processed successfully', resume: markdownResume });
  } catch (error) {
    console.error('Error processing resume prompt:', error);
    res.status(500).send('Error processing resume prompt');
  }
};

exports.getResumeByCareer = async (req, res) => {
  const { careerId } = req.params;

  try {
    const resume = await Resume.findOne({ careerId });

    if (!resume) {
      return res.status(404).json({ message: `No resume template found for career ${careerId}` });
    }

    res.status(200).json({ resume: resume.resume });
  } catch (error) {
    console.error('Error fetching resume:', error);
    res.status(500).send('Error fetching resume');
  }
};

exports.deleteResumeByCareer = async (req, res) => {
  const { careerId } = req.params;

  try {
    const resumeData = await Resume.findOneAndDelete({ careerId });

    if (!resumeData) {
      return res.status(404).json({ message: `No resume found for career ${careerId}` });
    }

    res.status(200).json({ message: `Resume for career ${careerId} has been deleted` });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).send('Error deleting resume');
  }
};

exports.getResumeCareerIds = async (req, res) => {
  try {
    const careers = await Resume.find({}, { careerId: 1, _id: 0 });

    const careerIds = careers.map(career => career.careerId);

    res.status(200).json(careerIds);
  } catch (error) {
    console.error('Error fetching career IDs:', error);
    res.status(500).send('Error fetching career IDs');
  }
};
