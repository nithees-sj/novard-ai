const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ['core', 'optional'], default: 'core' },
  known: { type: Boolean, default: false },
  description: String,
  why: String,
  searchQuery: String,
}, { _id: false });

const stageSchema = new mongoose.Schema({
  title: String,
  weeks: Number,
  startWeek: Number,
  endWeek: Number,
  objective: String,
  topics: [topicSchema],
  project: { title: String, description: String, skills: [String] },
  milestone: String,
}, { _id: false });

/** An AI-generated, personalised career roadmap (see services/roadmapService.js). */
const roadmapSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  role: { type: String, required: true, trim: true, maxlength: 80 },
  inputs: {
    level: String,
    hoursPerWeek: Number,
    timelineMonths: Number,
    knownSkills: [String],
    goal: String,
  },
  summary: String,
  stages: [stageSchema],
  careerTips: [String],
  totalWeeks: Number,
}, { timestamps: true });

roadmapSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Roadmap', roadmapSchema);
