const plans = require('../services/skillPlanService');
const { currentUserId } = require('../middleware/auth');

exports.generatePlan = async (req, res) => {
  const { skillName, duration, description, preferences } = req.body;
  const plan = await plans.createSkillPlan({ userId: currentUserId(req, req.body.userId), skillName, duration, description, preferences });
  res.status(201).json({
    planId: plan._id,
    skillName: plan.skillName,
    duration: plan.duration,
    dailyPlan: plan.dailyPlan.map(plans.presentDay),
    createdAt: plan.createdAt,
  });
};

exports.getUserPlans = async (req, res) => {
  res.json({ plans: await plans.listPlans(currentUserId(req, req.params.userId)) });
};

exports.generateQuiz = async (req, res) => {
  res.json(await plans.generatePlanQuiz({ userId: currentUserId(req, req.body.userId), planId: req.body.planId, body: req.body }));
};

exports.saveQuizResult = async (req, res) => {
  res.json(await plans.saveQuizResult({ ...req.body, userId: currentUserId(req, req.body.userId) }));
};

exports.toggleDayCompletion = async (req, res) => {
  const { planId, dayNumber } = req.body;
  res.json(await plans.toggleDay({ userId: currentUserId(req, req.body.userId), planId, dayNumber }));
};

exports.deletePlan = async (req, res) => {
  await plans.deletePlan({ userId: currentUserId(req), planId: req.params.planId });
  res.json({ message: 'Plan deleted successfully' });
};

exports.refreshVideo = async (req, res) => {
  const { planId, dayNumber } = req.body;
  res.json(await plans.refreshDayVideo({ userId: currentUserId(req, req.body.userId), planId, dayNumber }));
};

exports.startDayQuiz = async (req, res) => {
  const { planId, dayNumber } = req.body;
  res.status(201).json(await plans.startDayQuiz({ userId: currentUserId(req, req.body.userId), planId, dayNumber }));
};

exports.submitDayQuiz = async (req, res) => {
  const { planId, dayNumber, answers } = req.body;
  res.json(await plans.submitDayQuiz({ userId: currentUserId(req, req.body.userId), planId, dayNumber, answers }));
};
