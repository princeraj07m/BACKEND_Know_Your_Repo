const fs = require("fs");
const path = require("path");

exports.detect = (projectPath) => {
  const packagePath = path.join(projectPath, "package.json");

  if (!fs.existsSync(packagePath)) return "Unknown";

  const packageData = JSON.parse(fs.readFileSync(packagePath));
  const deps = packageData.dependencies || {};

  if (deps.express) return "Express.js";
  if (deps.react) return "React";
  if (deps.next) return "Next.js";

  return "Framework not detected";
};