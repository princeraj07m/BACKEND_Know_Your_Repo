const fs = require("fs-extra");
const path = require("path");

const IGNORE_DIRS = new Set(["node_modules", ".git", "vendor", "__pycache__", ".next", "dist", "build", ".cache", "coverage", ".nyc_output"]);
const IGNORE_FILES = new Set([".DS_Store", "Thumbs.db"]);

function buildTree(dir, basePath = "") {
  const items = [];
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch (err) {
    return items;
  }

  for (const name of names) {
    if (IGNORE_FILES.has(name)) continue;
    const fullPath = path.join(dir, name);
    const relativePath = basePath ? path.join(basePath, name) : name;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (IGNORE_DIRS.has(name)) continue;
      items.push({
        name: name + "/",
        children: buildTree(fullPath, relativePath),
        type: "dir"
      });
    } else {
      items.push({ name, type: "file", path: relativePath });
    }
  }
  return items.sort((a, b) => (a.type !== b.type ? (a.type === "dir" ? -1 : 1) : a.name.localeCompare(b.name)));
}

function getAllRelativePaths(dir, baseDir, list = []) {
  baseDir = baseDir || dir;
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch (err) {
    return list;
  }
  for (const name of names) {
    if (IGNORE_DIRS.has(name) || IGNORE_FILES.has(name)) continue;
    const fullPath = path.join(dir, name);
    const relativePath = path.relative(baseDir, fullPath);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllRelativePaths(fullPath, baseDir, list);
    } else {
      list.push(relativePath.replace(/\\/g, "/"));
    }
  }
  return list;
}

exports.scan = function scan(projectPath) {
  return buildTree(projectPath);
};

exports.getAllFiles = function getAllFiles(projectPath) {
  return getAllRelativePaths(projectPath);
};

exports.detectLanguage = function detectLanguage(projectPath) {
  if (fs.existsSync(path.join(projectPath, "package.json"))) return "JavaScript / Node.js";
  if (fs.existsSync(path.join(projectPath, "requirements.txt")) || fs.existsSync(path.join(projectPath, "setup.py"))) return "Python";
  if (fs.existsSync(path.join(projectPath, "go.mod"))) return "Go";
  if (fs.existsSync(path.join(projectPath, "Cargo.toml"))) return "Rust";
  if (fs.existsSync(path.join(projectPath, "pom.xml")) || fs.existsSync(path.join(projectPath, "build.gradle"))) return "Java";
  if (fs.existsSync(path.join(projectPath, "Gemfile"))) return "Ruby";
  return "Unknown";
};
