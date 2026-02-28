const fs = require("fs");
const path = require("path");

exports.analyze = (projectPath) => {
  const modelsPath = path.join(projectPath, "models");
  if (!fs.existsSync(modelsPath)) return [];

  return fs.readdirSync(modelsPath);
};