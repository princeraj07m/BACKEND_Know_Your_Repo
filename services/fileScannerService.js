const fs = require("fs-extra");
const path = require("path");

const IGNORE_DIRS = new Set(["node_modules", ".git", "vendor", "__pycache__", ".next", "dist", "build", ".cache", "coverage", ".nyc_output", "venv", ".venv"]);
const IGNORE_FILES = new Set([".DS_Store", "Thumbs.db"]);
const DEFAULT_MAX_DEPTH = 8;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

function buildTree(dir, basePath, depth, maxDepth) {
  depth = depth || 0;
  maxDepth = maxDepth ?? DEFAULT_MAX_DEPTH;
  if (depth > maxDepth) return [];
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
        children: buildTree(fullPath, relativePath, depth + 1, maxDepth),
        type: "dir"
      });
    } else {
      if (stat.size <= MAX_FILE_SIZE_BYTES) items.push({ name, type: "file", path: relativePath });
    }
  }
  return items.sort((a, b) => (a.type !== b.type ? (a.type === "dir" ? -1 : 1) : a.name.localeCompare(b.name)));
}

function getAllRelativePaths(dir, baseDir, list, maxDepth, depth) {
  baseDir = baseDir || dir;
  maxDepth = maxDepth ?? DEFAULT_MAX_DEPTH;
  depth = depth || 0;
  if (depth > maxDepth) return list;
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
      getAllRelativePaths(fullPath, baseDir, list, maxDepth, depth + 1);
    } else {
      if (stat.size <= MAX_FILE_SIZE_BYTES) list.push(relativePath.replace(/\\/g, "/"));
    }
  }
  return list;
}

exports.scan = function scan(projectPath, options) {
  const maxDepth = (options && options.maxDepth) ?? DEFAULT_MAX_DEPTH;
  return buildTree(projectPath, "", 0, maxDepth);
};

exports.getAllFiles = function getAllFiles(projectPath, options) {
  const maxDepth = (options && options.maxDepth) ?? DEFAULT_MAX_DEPTH;
  return getAllRelativePaths(projectPath, undefined, [], maxDepth, 0);
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

const projectTypeDetector = require("./projectTypeDetector");

exports.getRootModules = function getRootModules(projectPath) {
  try {
    const result = projectTypeDetector.detect(projectPath);
    return {
      frontendRoots: result.frontendRoots || [],
      backendRoots: result.backendRoots || [],
      mlRoots: result.mlRoots || [],
      isMonorepo: result.isMonorepo === true
    };
  } catch (e) {
    return { frontendRoots: [], backendRoots: [], mlRoots: [], isMonorepo: false };
  }
};

exports.scanRoot = function scanRoot(projectPath, rootDir, options) {
  const target = rootDir === "." ? projectPath : path.join(projectPath, rootDir);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) return [];
  const maxDepth = (options && options.maxDepth) ?? DEFAULT_MAX_DEPTH;
  return buildTree(target, rootDir === "." ? "" : rootDir, 0, maxDepth);
};
