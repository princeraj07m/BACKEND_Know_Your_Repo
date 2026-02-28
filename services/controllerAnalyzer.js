const fs = require("fs");
const path = require("path");

const EXPORT_REG = /module\.exports\s*=\s*\{([^}]+)\}|exports\.(\w+)\s*=/g;
const FUNCTION_REG = /(?:function\s+(\w+)|(\w+)\s*:\s*function|(\w+)\s*\([^)]*\)\s*=>)/g;

function getExportedMethods(content) {
  const methods = new Set();
  let m;
  EXPORT_REG.lastIndex = 0;
  while ((m = EXPORT_REG.exec(content)) !== null) {
    if (m[2]) methods.add(m[2]);
    if (m[1]) {
      const block = m[1];
      FUNCTION_REG.lastIndex = 0;
      let fm;
      while ((fm = FUNCTION_REG.exec(block)) !== null) {
        const name = fm[1] || fm[2] || fm[3];
        if (name) methods.add(name);
      }
      const propNames = block.match(/(\w+)\s*:/g);
      if (propNames) propNames.forEach((p) => methods.add(p.replace(/\s*:\s*$/, "").trim()));
    }
  }
  const exportDefault = content.match(/module\.exports\s*=\s*(\w+)/);
  if (exportDefault) methods.add(exportDefault[1]);
  return Array.from(methods);
}

function scanDir(dir, basePath, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(basePath, full).replace(/\\/g, "/");
    if (e.isDirectory() && e.name !== "node_modules") {
      scanDir(full, basePath, results);
    } else if (e.isFile() && /\.(js|mjs|cjs|ts)$/.test(e.name)) {
      try {
        const content = fs.readFileSync(full, "utf8");
        const methods = getExportedMethods(content);
        const name = path.basename(e.name, path.extname(e.name));
        results.push({ name, file: rel, methods });
      } catch (err) {
        // skip
      }
    }
  }
  return results;
}

exports.analyze = function analyze(projectPath) {
  const controllersDir = path.join(projectPath, "controllers");
  const list = scanDir(controllersDir, projectPath);
  return list.filter((c) => c.methods.length > 0 || c.name.toLowerCase().includes("controller"));
};
