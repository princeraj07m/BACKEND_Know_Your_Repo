const mongoose = require("mongoose");

const repositorySchema = new mongoose.Schema({
  repoUrl: { type: String, required: true },
  analyzedAt: { type: Date, default: Date.now },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: "AnalysisReport" }
});

module.exports = mongoose.model("Repository", repositorySchema);
