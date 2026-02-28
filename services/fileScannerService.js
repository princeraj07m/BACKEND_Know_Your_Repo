const fs = require("fs");
const path = require("path");

exports.scan = function scan(dir) {
  return fs.readdirSync(dir);
};

exports.detectLanguage = (projectPath) => {
  if (fs.existsSync(path.join(projectPath, "package.json")))
    return "JavaScript / Node.js";

  if (fs.existsSync(path.join(projectPath, "requirements.txt")))
    return "Python";

  return "Unknown";
};