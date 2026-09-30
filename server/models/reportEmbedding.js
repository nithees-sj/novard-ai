const mongoose = require('mongoose');

/**
 * One report's embedding, kept apart from the report so report reads stay
 * small. Searched with Atlas Vector Search (index `report_vec` on `vec`,
 * filtered by area and time: npm run db:vector-index) and clustered into
 * topics per area.
 */
const reportEmbeddingSchema = new mongoose.Schema({
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true, unique: true },
  area: { type: String, required: true },
  createdAt: { type: Date, required: true }, // the report's time, for the window filter
  vec: { type: [Number], required: true },
  model: String,
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportTopic' },
});

reportEmbeddingSchema.index({ area: 1, createdAt: -1 });
reportEmbeddingSchema.index({ topicId: 1 });

module.exports = mongoose.model('ReportEmbedding', reportEmbeddingSchema);
