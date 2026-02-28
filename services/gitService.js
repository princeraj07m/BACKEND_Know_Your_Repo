const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");

const TEMP_BASE = path.join(process.cwd(), "temp");

async function ensureTempDir() {
  await fs.ensureDir(TEMP_BASE);
}

exports.cloneRepo = async function cloneRepo(repoUrl) {
  await ensureTempDir();
  const slug = repoUrl.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60) + "_" + Date.now();
  const tempPath = path.join(TEMP_BASE, slug);
  await fs.remove(tempPath).catch(() => {});
  const git = simpleGit();
  await git.clone(repoUrl, tempPath, ["--depth", "1"]);
  return tempPath;
};

exports.cleanTemp = async function cleanTemp(projectPath) {
  if (!projectPath || !projectPath.startsWith(TEMP_BASE)) return;
  try {
    await fs.remove(projectPath);
  } catch (err) {
    console.error("Clean temp error:", err.message);
  }
};
