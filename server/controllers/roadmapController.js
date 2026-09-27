const roadmaps = require('../services/roadmapService');
const { currentUserId } = require('../middleware/auth');

exports.generate = async (req, res) => {
  const saved = await roadmaps.createRoadmapFor(currentUserId(req, req.body.userId), req.body);
  res.status(201).json(roadmaps.presentRoadmap(saved));
};

exports.listForUser = async (req, res) => {
  res.json(await roadmaps.listRoadmaps(currentUserId(req, req.params.userId)));
};

exports.getOne = async (req, res) => {
  res.json(await roadmaps.getRoadmap(currentUserId(req, req.query.userId), req.params.id));
};

exports.remove = async (req, res) => {
  await roadmaps.deleteRoadmap(currentUserId(req, req.body?.userId || req.query.userId), req.params.id);
  res.json({ success: true });
};
