const mongoose = require('mongoose');

/**
 * A cluster of similar reports within an area (EWDI topics, greedy cosine
 * clustering). The label is the most common enrichment topic among its
 * reports. Risk objects are keyed by area + topic label.
 */
const reportTopicSchema = new mongoose.Schema({
  area: { type: String, required: true },
  label: { type: String, required: true },
  centroid: { type: [Number], default: [] },
  recordCount: { type: Number, default: 0 },
  firstSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

reportTopicSchema.index({ area: 1, recordCount: -1 });

module.exports = mongoose.model('ReportTopic', reportTopicSchema);
