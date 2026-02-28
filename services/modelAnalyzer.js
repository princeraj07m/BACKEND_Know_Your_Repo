const fs = require("fs");
const path = require("path");

const SCHEMA_REG = /(?:new\s+mongoose\.Schema|Schema\s*\(\s*)\s*\(\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
const SCHEMA_FIELD_REG = /(\w+)\s*:\s*\{[^}]*\}|(\w+)\s*:\s*[^\n,}]+/g;

function getSchemaSummary(content) {
  const fields = [];
  let m;
  SCHEMA_REG.lastIndex = 0;
  while ((m = SCHEMA_REG.exec(content)) !== null) {
    const block = m[1];
    SCHEMA_FIELD_REG.lastIndex = 0;
    let fm;
    while ((fm = SCHEMA_FIELD_REG.exec(block)) !== null) {
      const name = fm[1] || fm[2];
      if (name && !fields.includes(name)) fields.push(name);
    }
  }
  const simpleFields = content.match(/(\w+)\s*:\s*\{\s*type\s*:/g);
  if (simpleFields) {
    simpleFields.forEach((s) => {
      const name = s.split(":")[0].trim();
      if (name && !fields.includes(name)) fields.push(name);
    });
  }
  return fields.length ? fields.join(", ") : "Schema detected (fields not parsed)";
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
        if (!/mongoose|Schema|model|sequelize|define/i.test(content)) continue;
        const name = path.basename(e.name, path.extname(e.name));
        const schemaSummary = getSchemaSummary(content);
        results.push({ name, file: rel, schemaSummary });
      } catch (err) {
        // skip
      }
    }
  }
  return results;
}

exports.analyze = function analyze(projectPath) {
  const modelsDir = path.join(projectPath, "models");
  return scanDir(modelsDir, projectPath);
};
