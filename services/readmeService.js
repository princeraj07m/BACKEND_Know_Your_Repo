const fs = require("fs");
const path = require("path");

const README_NAMES = ["README.md", "README.MD", "readme.md", "README.txt", "README"];

function findAndReadReadme(projectPath) {
  for (const name of README_NAMES) {
    const p = path.join(projectPath, name);
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p, "utf8");
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

exports.getReadmeSummary = function getReadmeSummary(projectPath, maxChars = 1500) {
  const raw = findAndReadReadme(projectPath);
  if (!raw) return null;
  const trimmed = raw.replace(/\r\n/g, "\n").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars) + "\n\n... (truncated)";
};
