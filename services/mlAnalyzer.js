const fs = require("fs");
const path = require("path");

const DATA_DIRS = ["data", "datasets", "dataset", "raw_data", "data/raw", "inputs"];
const TRAIN_PATTERNS = ["train", "training", "fit", "train_model"];
const INFER_PATTERNS = ["inference", "infer", "predict", "serve"];
const PREPROCESS_PATTERNS = ["preprocess", "preprocessing", "transform", "prepare_data", "load_data"];
const EVAL_PATTERNS = ["eval", "evaluate", "evaluation", "metrics"];

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return [];
  }
}

function readRequirements(projectPath) {
  const p = path.join(projectPath, "requirements.txt");
  if (!fs.existsSync(p)) return [];
  try {
    const content = fs.readFileSync(p, "utf8");
    return content.split("\n").map((l) => l.split("==")[0].split(">=")[0].trim().toLowerCase()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function readPyproject(projectPath) {
  const p = path.join(projectPath, "pyproject.toml");
  if (!fs.existsSync(p)) return [];
  try {
    const content = fs.readFileSync(p, "utf8");
    const deps = [];
    let inDep = false;
    content.split("\n").forEach((line) => {
      if (line.trim().startsWith("dependencies") || line.includes("dependencies =")) inDep = true;
      if (inDep && (line.includes('"') || line.includes("'"))) {
        const m = line.match(/["']([a-zA-Z0-9_-]+)["']/);
        if (m) deps.push(m[1].toLowerCase());
      }
    });
    return deps;
  } catch (e) {
    return [];
  }
}

function detectLibs(projectPath) {
  const req = readRequirements(projectPath);
  const py = readPyproject(projectPath);
  const all = [...new Set([...req, ...py])];
  const libs = [];
  if (all.some((d) => d.includes("tensorflow") || d === "tf")) libs.push("TensorFlow");
  if (all.some((d) => d.includes("torch") || d === "pytorch")) libs.push("PyTorch");
  if (all.some((d) => d.includes("sklearn") || d.includes("scikit-learn"))) libs.push("Scikit-learn");
  if (all.some((d) => d.includes("keras") && !d.includes("tensorflow"))) libs.push("Keras");
  if (all.some((d) => d.includes("xgboost"))) libs.push("XGBoost");
  if (all.some((d) => d.includes("pandas"))) libs.push("Pandas");
  if (all.some((d) => d.includes("numpy"))) libs.push("NumPy");
  return libs;
}

function findNotebooks(projectPath, max) {
  const list = [];
  const cap = max || 100;
  function walk(dir) {
    if (list.length >= cap) return;
    const entries = safeReaddir(dir);
    for (const e of entries) {
      if (list.length >= cap) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !["node_modules", ".git", "__pycache__", ".venv", "venv"].includes(e.name)) walk(full);
      else if (e.isFile() && e.name.endsWith(".ipynb")) list.push(path.relative(projectPath, full).replace(/\\/g, "/"));
    }
  }
  try {
    walk(projectPath);
  } catch (e) {}
  return list;
}

function findScriptsByPattern(projectPath, patterns, ext, max) {
  const list = [];
  const cap = max || 80;
  function walk(dir) {
    if (list.length >= cap) return;
    const entries = safeReaddir(dir);
    for (const e of entries) {
      if (list.length >= cap) return;
      const full = path.join(dir, e.name);
      const rel = path.relative(projectPath, full).replace(/\\/g, "/");
      const lower = e.name.toLowerCase();
      if (e.isDirectory() && !["node_modules", ".git", "__pycache__", ".venv", "venv"].includes(e.name)) walk(full);
      else if (e.isFile() && ext.test(e.name) && patterns.some((p) => lower.includes(p))) list.push(rel);
    }
  }
  try {
    walk(projectPath);
  } catch (e) {}
  return list;
}

function findDatasetFolders(projectPath) {
  const list = [];
  for (const d of DATA_DIRS) {
    const full = path.join(projectPath, d);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) list.push(d);
  }
  try {
    const entries = safeReaddir(projectPath);
    for (const e of entries) {
      if (e.isDirectory() && (e.name.toLowerCase().includes("data") || e.name.toLowerCase().includes("dataset"))) list.push(e.name);
    }
  } catch (e) {}
  return [...new Set(list)];
}

exports.analyze = function analyze(projectPath, rootDir = ".") {
  try {
    const rootPath = rootDir === "." ? projectPath : path.join(projectPath, rootDir);
    if (!fs.existsSync(rootPath)) {
      return { hasPython: false, hasNotebooks: false, libs: [], trainingScripts: [], inferenceScripts: [], preprocessingScripts: [], evaluationScripts: [], datasetFolders: [], pipelineExplanation: "" };
    }
    const hasRequirements = fs.existsSync(path.join(rootPath, "requirements.txt")) || fs.existsSync(path.join(rootPath, "pyproject.toml"));
    const hasPython = hasRequirements || findNotebooks(rootPath, 1).length > 0 || fs.readdirSync(rootPath, { withFileTypes: true }).some((e) => e.isFile() && e.name.endsWith(".py"));
    const notebooks = findNotebooks(rootPath);
    const libs = detectLibs(rootPath);
    const trainingScripts = findScriptsByPattern(rootPath, TRAIN_PATTERNS, /\.py$/);
    const inferenceScripts = findScriptsByPattern(rootPath, INFER_PATTERNS, /\.py$/);
    const preprocessingScripts = findScriptsByPattern(rootPath, PREPROCESS_PATTERNS, /\.py$/);
    const evaluationScripts = findScriptsByPattern(rootPath, EVAL_PATTERNS, /\.py$/);
    const datasetFolders = findDatasetFolders(rootPath);

    let pipelineExplanation = "ML pipeline (typical flow):\n";
    pipelineExplanation += "1. Data: " + (datasetFolders.length ? datasetFolders.join(", ") : "not detected") + "\n";
    pipelineExplanation += "2. Preprocessing: " + (preprocessingScripts.length ? preprocessingScripts.slice(0, 5).join(", ") : "scripts not detected") + "\n";
    pipelineExplanation += "3. Training: " + (trainingScripts.length ? trainingScripts.slice(0, 5).join(", ") : "scripts not detected") + "\n";
    pipelineExplanation += "4. Evaluation: " + (evaluationScripts.length ? evaluationScripts.slice(0, 5).join(", ") : "scripts not detected") + "\n";
    pipelineExplanation += "5. Inference: " + (inferenceScripts.length ? inferenceScripts.slice(0, 5).join(", ") : "scripts not detected") + "\n";
    if (notebooks.length) pipelineExplanation += "Notebooks: " + notebooks.slice(0, 10).join(", ") + (notebooks.length > 10 ? "..." : "") + "\n";

    return {
      hasPython,
      hasNotebooks: notebooks.length > 0,
      libs,
      trainingScripts,
      inferenceScripts,
      preprocessingScripts,
      evaluationScripts,
      datasetFolders,
      notebooks: notebooks.slice(0, 50),
      pipelineExplanation
    };
  } catch (err) {
    return { hasPython: false, hasNotebooks: false, libs: [], trainingScripts: [], inferenceScripts: [], preprocessingScripts: [], evaluationScripts: [], datasetFolders: [], pipelineExplanation: "" };
  }
};
