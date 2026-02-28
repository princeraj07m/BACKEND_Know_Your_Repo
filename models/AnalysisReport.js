const mongoose = require("mongoose");

const analysisReportSchema = new mongoose.Schema({
  repoUrl: { type: String, required: true },
  language: String,
  framework: String,
  architecture: String,
  entryPoint: String,
  folderTree: mongoose.Schema.Types.Mixed,
  routes: [{
    method: String,
    path: String,
    handler: String,
    sourceFile: String
  }],
  controllers: [{
    name: String,
    file: String,
    methods: [String]
  }],
  models: [{
    name: String,
    file: String,
    schemaSummary: String
  }],
  readmeSummary: String,
  summary: String,
  executionFlow: String,
  projectType: String,
  frontend: mongoose.Schema.Types.Mixed,
  ml: mongoose.Schema.Types.Mixed,
  modules: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("AnalysisReport", analysisReportSchema);
