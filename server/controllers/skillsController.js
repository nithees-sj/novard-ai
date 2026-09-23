const Skills = require('../models/skills');
const Groq = require('groq-sdk');
const { MODELS, GROQ_DEFAULTS } = require('../config/ai');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

exports.processSkillsPrompt = async (req, res) => {
  const { career, count } = req.body;
  console.log(req.body);

  try {
    const prompt = `Give me the ${count} most important technical skills required for a ${career} engineer.

For each skill, use a ### heading with the skill name, then cover:
- **What it is** - a clear two to three sentence explanation
- **Why it matters for this role** - the concrete problems it solves day to day
- **What "good" looks like** - the specific capabilities expected at a hireable level
- **How to learn it** - the practical path, and roughly how long it takes
- **Tools and technologies** - the specific ones used in industry

Be specific and concrete. Name real tools, real versions, real practices rather
than generic advice. Return GitHub-flavoured Markdown. Never emit raw HTML.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      model: MODELS.REASONING,
      ...GROQ_DEFAULTS,
      temperature: 0.5,
      max_tokens: 3500,
      top_p: 1,
      stream: false,
    });

    const content = chatCompletion.choices[0]?.message?.content || "";

    // Ensure the content is trimmed and properly formatted as Markdown
    const markdownSkills = content.trim();

    // Store the Markdown skills content in the database
    const existingSkills = await Skills.findOneAndUpdate(
      { careerId: career },
      { $set: { skills: markdownSkills } },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: 'Skills prompt processed successfully', skills: markdownSkills });
  } catch (error) {
    console.error('Error processing skills prompt:', error);
    res.status(500).send('Error processing skills prompt');
  }
};


exports.getSkillsByCareer = async (req, res) => {
  const { careerId } = req.params;

  try {
    const skillsData = await Skills.findOne({ careerId });

    if (!skillsData) {
      return res.status(404).json({ message: `No skills found for career ${careerId}` });
    }

    res.status(200).json({ skills: skillsData.skills });
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).send('Error fetching skills');
  }
};


exports.deleteSkillsByCareer = async (req, res) => {
  const { careerId } = req.params;

  try {
    // Find the career by careerId and delete its associated skills
    const skillsData = await Skills.findOneAndDelete({ careerId });

    if (!skillsData) {
      return res.status(404).json({ message: `No skills found for career ${careerId}` });
    }

    res.status(200).json({ message: `Skills for career ${careerId} have been deleted` });
  } catch (error) {
    console.error('Error deleting skills:', error);
    res.status(500).send('Error deleting skills');
  }
};

exports.getCareerIds = async (req, res) => {
  try {
    const careers = await Skills.find({}, { careerId: 1, _id: 0 });  // Only fetch careerId, exclude _id

    const careerIds = careers.map(career => career.careerId); // Extract the careerId field

    res.status(200).json(careerIds);  // Return the careerIds array directly
  } catch (error) {
    console.error('Error fetching career IDs:', error);
    res.status(500).send('Error fetching career IDs');
  }
};
