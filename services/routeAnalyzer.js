const fs = require("fs");
const path = require("path");

exports.analyze = (projectPath) => {
  const routesPath = path.join(projectPath, "routes");
  if (!fs.existsSync(routesPath)) return [];

  return fs.readdirSync(routesPath);
};