const fs = require("fs");
const path = require("path");

const ROUTE_METHODS = ["get", "post", "put", "patch", "delete", "all"];
const ROUTE_REG = new RegExp(
  "\\.(?:".concat(ROUTE_METHODS.join("|"), ")\\s*\\(\\s*[`'\"]([^`'\"]*)[`'\"]\\s*,\\s*([^)]+)\\)"),
  "g"
);
const ROUTER_USE_REG = /(?:router|app)\s*\.\s*use\s*\(\s*[`'"]([^`'"]*)[`'"]\s*,\s*require\s*\(\s*[`'"]([^`'"]+)[`'"]\s*\)/g;
const ROUTER_USE_REG2 = /(?:router|app)\s*\.\s*use\s*\(\s*[`'"]([^`'"]*)[`'"]\s*,\s*(\w+)\s*\)/g;

function extractRoutesFromContent(content, sourceFile) {
  const routes = [];
  let m;
  ROUTE_REG.lastIndex = 0;
  while ((m = ROUTE_REG.exec(content)) !== null) {
    const method = m[0].match(/\.(get|post|put|patch|delete|all)/)[1].toUpperCase();
    const routePath = m[1].trim();
    const handler = m[2].trim();
    let handlerName = handler;
    if (handler.startsWith("require(")) {
      const reqMatch = handler.match(/require\s*\(\s*[`'"]([^`'"]+)[`'"]\s*\)\.(\w+)?/);
      handlerName = reqMatch ? (reqMatch[2] ? `${reqMatch[1]}.${reqMatch[2]}` : reqMatch[1]) : handler;
    } else if (/^\w+$/.test(handler)) {
      handlerName = handler;
    } else if (handler.includes(".")) {
      handlerName = handler.split(".").pop().trim();
    }
    routes.push({ method, path: routePath, handler: handlerName, sourceFile });
  }
  return routes;
}

function scanDirForJs(dir, basePath, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(basePath, full).replace(/\\/g, "/");
    if (e.isDirectory() && e.name !== "node_modules") {
      scanDirForJs(full, basePath, results);
    } else if (e.isFile() && /\.(js|mjs|cjs|ts)$/.test(e.name)) {
      try {
        const content = fs.readFileSync(full, "utf8");
        const routes = extractRoutesFromContent(content, rel);
        results.push(...routes);
      } catch (err) {
        // skip
      }
    }
  }
  return results;
}

exports.analyze = function analyze(projectPath) {
  const routes = scanDirForJs(projectPath, projectPath);
  const routesDir = path.join(projectPath, "routes");
  const routeFiles = scanDirForJs(routesDir, projectPath);
  const appPath = path.join(projectPath, "app.js");
  const indexPath = path.join(projectPath, "index.js");
  const serverPath = path.join(projectPath, "server.js");
  const mainPaths = [appPath, indexPath, serverPath];
  const seen = new Set();
  const out = [];
  for (const r of [...routeFiles, ...routes]) {
    const key = `${r.method}:${r.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out.sort((a, b) => (a.sourceFile || "").localeCompare(b.sourceFile || "") || a.path.localeCompare(b.path));
};
