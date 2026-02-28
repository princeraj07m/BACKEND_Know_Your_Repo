const mongoose = require("mongoose");

const analysisSchema = new mongoose.Schema({
  repoUrl: String,
  language: String,
  framework: String,
  architecture: String,
  routes: Array,
  controllers: Array,
  models: Array,
  summary: String,
  executionFlow: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("AnalysisReport", analysisSchema);