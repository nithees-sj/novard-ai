const Roadmap = require('../models/roadmap');
const { readRoadmapInput, generateRoadmap, buildRoadmapMermaid } = require('../services/roadmapService');

/** Full roadmap plus its diagram. The diagram is rebuilt on every read, so
 *  styling improvements apply to roadmaps generated earlier too. */
function present(doc) {
  const r = doc.toObject ? doc.toObject() : doc;
  return {
    ...r,
    mermaid: buildRoadmapMermaid(r, { role: r.role, ...r.inputs }),
  };
}

const generate = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const input = readRoadmapInput(req.body);
    if (input.role.length < 2) {
      return res.status(400).json({ error: 'Tell us which role you want to reach, e.g. "Frontend Developer".' });
    }

    const roadmap = await generateRoadmap(input);
    const saved = await Roadmap.create({
      userId,
      role: input.role,
      inputs: {
        level: input.level,
        hoursPerWeek: input.hoursPerWeek,
        timelineMonths: input.timelineMonths,
        knownSkills: input.knownSkills,
        goal: input.goal,
      },
      ...roadmap,
    });
    res.status(201).json(present(saved));
  } catch (error) {
    console.error('Error generating roadmap:', error.cause || error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to generate roadmap' });
  }
};

const listForUser = async (req, res) => {
  try {
    const docs = await Roadmap.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .select('role inputs totalWeeks stages.title createdAt')
      .lean();
    res.json(docs.map((d) => ({
      _id: d._id,
      role: d.role,
      level: d.inputs?.level,
      timelineMonths: d.inputs?.timelineMonths,
      hoursPerWeek: d.inputs?.hoursPerWeek,
      totalWeeks: d.totalWeeks,
      stageCount: (d.stages || []).length,
      createdAt: d.createdAt,
    })));
  } catch (error) {
    console.error('Error listing roadmaps:', error);
    res.status(500).json({ error: 'Failed to load roadmaps' });
  }
};

const getOne = async (req, res) => {
  try {
    const doc = await Roadmap.findOne({ _id: req.params.id, userId: req.query.userId }).lean().catch(() => null);
    if (!doc) return res.status(404).json({ error: 'Roadmap not found' });
    res.json(present(doc));
  } catch (error) {
    console.error('Error loading roadmap:', error);
    res.status(500).json({ error: 'Failed to load roadmap' });
  }
};

const remove = async (req, res) => {
  try {
    const userId = req.body?.userId || req.query.userId;
    const result = await Roadmap.deleteOne({ _id: req.params.id, userId }).catch(() => ({ deletedCount: 0 }));
    if (!result.deletedCount) return res.status(404).json({ error: 'Roadmap not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting roadmap:', error);
    res.status(500).json({ error: 'Failed to delete roadmap' });
  }
};

module.exports = { generate, listForUser, getOne, remove };
