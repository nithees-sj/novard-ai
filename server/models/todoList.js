const mongoose = require('mongoose');

/**
 * A student's todo list. Items keep their order in the array; due dates are
 * calendar days ("YYYY-MM-DD") in the student's own time zone, so a task due
 * "today" never shifts a day for a student far from UTC.
 */

const subtaskSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 200 },
  done: { type: Boolean, default: false },
});

const itemSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 200 },
  notes: { type: String, default: '', maxlength: 2000 },
  done: { type: Boolean, default: false },
  doneAt: { type: Date, default: null },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: null },
  dueDate: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  subtasks: { type: [subtaskSchema], default: [] },
  // The due date a reminder was already sent for: a new date re-arms it.
  remindedFor: { type: String, default: null },
}, { timestamps: true });

const todoListSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // email
  title: { type: String, required: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 500 },
  source: { type: String, enum: ['manual', 'ai', 'agent'], default: 'manual' },
  // The Skill Unlocker plan this list was turned into.
  skillPlanId: { type: mongoose.Schema.Types.ObjectId, default: null },
  // Set while the plan is being generated, so a double click makes one plan.
  convertingAt: { type: Date, default: null },
  items: { type: [itemSchema], default: [] },
}, { timestamps: true });

todoListSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('TodoList', todoListSchema);
