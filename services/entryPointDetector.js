const fs = require("fs");
const path = require("path");

function readPackageJson(projectPath) {
  const p = path.join(projectPath, "package.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

exports.getEntryPoint = function getEntryPoint(projectPath) {
  const pkg = readPackageJson(projectPath);
  if (pkg && pkg.main && typeof pkg.main === "string") {
    const candidate = path.join(projectPath, pkg.main);
    if (fs.existsSync(candidate)) return pkg.main;
  }
  const candidates = [
    "app.js", "index.js", "server.js", "src/index.js", "src/app.js", "main.js",
    "src/main.jsx", "src/main.tsx", "src/main.js", "src/index.jsx", "src/index.tsx",
    "src/App.jsx", "src/App.tsx", "index.html"
  ];
  for (const c of candidates) {
    const full = path.join(projectPath, c);
    if (fs.existsSync(full)) return c;
  }
  return "Not detected";
};
