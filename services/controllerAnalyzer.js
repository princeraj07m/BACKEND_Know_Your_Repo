const fs = require("fs");
const path = require("path");

exports.analyze = (projectPath) => {
  const controllersPath = path.join(projectPath, "controllers");
  if (!fs.existsSync(controllersPath)) return [];

  return fs.readdirSync(controllersPath);
};