const Project = require('../models/projects');
const Groq = require('groq-sdk');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

exports.processProjectPrompt = async (req, res) => {
  const { career, count } = req.body;
  console.log(req.body);

  try {
    const prompt = `Give me ${count} portfolio-grade project ideas that a ${career} engineer could build.

For each project use a ### heading with the project title, then cover:
- **What it does** - two to three sentences on the problem it solves and who it is for
- **Why it impresses a recruiter** - the specific skill it demonstrates
- **Tech stack** - concrete technologies, and one line on why each was chosen
- **Modules to implement** - each as its own bullet with a sentence on what it involves
- **Build order** - the sequence to tackle it in, and what to get working first
- **Tips and pitfalls** - the specific things that trip people up on this project
- **Stretch goals** - what to add once the core works
- **Estimated time** - a realistic range for each phase

Be concrete: name real libraries and real APIs rather than generic advice.
Separate each project with a horizontal rule (---).
Return GitHub-flavoured Markdown. Never emit raw HTML.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      model: MODELS.REASONING,
      ...GROQ_DEFAULTS,
      temperature: 0.5,
      max_tokens: 6000,
      top_p: 1,
      stream: false,
    });

    const content = chatCompletion.choices[0]?.message?.content || "";

    // Trim and clean up the Markdown content
    const markdownProjects = content.trim();

    // Store the Markdown projects content in the database
    const existingProjects = await Project.findOneAndUpdate(
      { careerId: career },
      { $set: { projects: markdownProjects } },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: 'Project prompt processed successfully', projects: markdownProjects });
  } catch (error) {
    console.error('Error processing project prompt:', error);
    res.status(500).send('Error processing project prompt');
  }
};

exports.getProjectsByCareer = async (req, res) => {
  const { careerId } = req.params;

  try {
    const project = await Project.findOne({ careerId });

    if (!project) {
      return res.status(404).json({ message: `No projects found for career ${careerId}` });
    }

    // Return the projects
    res.status(200).json({ projects: project.projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).send('Error fetching projects');
  }
};

exports.deleteProjectsByCareer = async (req, res) => {
  const { careerId } = req.params;

  try {
    // Find the career by careerId and delete its associated skills
    const ProjectsData = await Project.findOneAndDelete({ careerId });

    if (!ProjectsData) {
      return res.status(404).json({ message: `No skills found for career ${careerId}` });
    }

    res.status(200).json({ message: `Skills for career ${careerId} have been deleted` });
  } catch (error) {
    console.error('Error deleting skills:', error);
    res.status(500).send('Error deleting skills');
  }
};

exports.getProjectCareerIds = async (req, res) => {
  try {
    const careers = await Project.find({}, { careerId: 1, _id: 0 });  // Only fetch careerId, exclude _id

    const careerIds = careers.map(career => career.careerId); // Extract the careerId field

    res.status(200).json(careerIds);  // Return the careerIds array directly
  } catch (error) {
    console.error('Error fetching career IDs:', error);
    res.status(500).send('Error fetching career IDs');
  }
};
