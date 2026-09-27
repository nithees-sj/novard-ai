const requests = require('../services/videoRequestService');
const { currentUserId } = require('../middleware/auth');

exports.list = async (req, res) => {
  res.json(await requests.listRequests(currentUserId(req, req.params.userId)));
};

exports.create = async (req, res) => {
  const { title, description, platform } = req.body;
  const saved = await requests.createRequest({ userId: currentUserId(req, req.body.userId), title, description, platform });
  res.status(201).json(saved);
};

exports.remove = async (req, res) => {
  await requests.deleteRequest({ userId: currentUserId(req), requestId: req.params.videoRequestId });
  res.json({ message: 'Video request deleted successfully' });
};

exports.recommend = async (req, res) => {
  const { title, description, platform } = req.body;
  res.json({ videos: await requests.recommend({ title, description, platform }) });
};
