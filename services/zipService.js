const path = require("path");
const fs = require("fs-extra");

const TEMP_BASE = path.join(process.cwd(), "temp");
const MAX_ZIP_SIZE = 100 * 1024 * 1024;
const FORBIDDEN_PATH = /\.\./;

function isPathSafe(entryPath, destDir) {
  const normalized = path.normalize(entryPath).replace(/\\/g, "/");
  if (FORBIDDEN_PATH.test(normalized)) return false;
  const resolved = path.resolve(destDir, normalized);
  const destReal = path.resolve(destDir);
  return resolved.startsWith(destReal);
}

async function ensureTempDir() {
  await fs.ensureDir(TEMP_BASE);
}

exports.extractZip = async function extractZip(zipPath) {
  await ensureTempDir();
  const stat = await fs.stat(zipPath).catch(() => null);
  if (!stat || !stat.isFile()) throw new Error("Invalid ZIP file.");
  if (stat.size > MAX_ZIP_SIZE) throw new Error("ZIP file exceeds maximum size (100MB).");

  const AdmZip = require("adm-zip");
  const zip = new AdmZip(zipPath);
  const slug = "zip_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  const extractPath = path.join(TEMP_BASE, slug);
  await fs.ensureDir(extractPath);

  const entries = zip.getEntries();
  for (const entry of entries) {
    if (!entry.entryName || entry.entryName.includes("__MACOSX")) continue;
    const cleanName = entry.entryName.replace(/^[^/]+?\//, "");
    if (!cleanName) continue;
    const targetPath = path.join(extractPath, cleanName);
    if (!isPathSafe(cleanName, extractPath)) continue;
    if (entry.isDirectory) {
      await fs.ensureDir(targetPath);
    } else {
      await fs.ensureDir(path.dirname(targetPath));
      const data = entry.getData();
      if (Buffer.isBuffer(data)) await fs.writeFile(targetPath, data);
    }
  }
  const firstDir = await fs.readdir(extractPath).then((names) => {
    const dirs = names.filter((n) => {
      const p = path.join(extractPath, n);
      return fs.statSync(p).isDirectory() && !n.startsWith(".");
    });
    return dirs.length === 1 ? path.join(extractPath, dirs[0]) : extractPath;
  }).catch(() => extractPath);
  return { extractPath: firstDir, tempRoot: extractPath };
};

exports.cleanZipExtract = async function cleanZipExtract(tempRoot) {
  if (!tempRoot || !path.resolve(tempRoot).startsWith(path.resolve(TEMP_BASE))) return;
  try {
    await fs.remove(tempRoot);
  } catch (err) {
    console.error("Clean zip extract error:", err.message);
  }
};

exports.MAX_ZIP_SIZE = MAX_ZIP_SIZE;
