const mongoose = require("mongoose");

const repositorySchema = new mongoose.Schema({
  repoUrl: String,
  analyzedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Repository", repositorySchema);