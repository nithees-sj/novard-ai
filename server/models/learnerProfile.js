const mongoose = require('mongoose');

/**
 * What the Novard Agent knows about a student across chats: their level,
 * target role, skills and study preferences. It only changes when the student
 * confirms (a "Remember this?" card, the "remember these details" box on a
 * draft, or editing it themselves); see services/learnerProfileService.js.
 */
const learnerProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  level: { type: String, enum: ['beginner', 'intermediate', 'experienced'] },
  experience: { type: String, enum: ['student', 'junior', 'switching', 'experienced'] },
  targetRole: { type: String, maxlength: 80 },
  knownSkills: { type: [String], default: undefined },
  interests: { type: [String], default: undefined },
  hoursPerWeek: { type: Number, min: 1, max: 60 },
  timelineMonths: { type: Number, min: 1, max: 24 },
  goal: { type: String, maxlength: 240 },
  language: { type: String, maxlength: 40 },
  teachingStyle: { type: String, maxlength: 60 },
  notes: { type: String, maxlength: 500 },
}, { timestamps: true });

module.exports = mongoose.model('LearnerProfile', learnerProfileSchema);
