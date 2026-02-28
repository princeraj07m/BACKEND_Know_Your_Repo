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

exports.detect = function detect(projectPath) {
  const pkg = readPackageJson(projectPath);
  if (!pkg) {
    if (fs.existsSync(path.join(projectPath, "manage.py"))) return "Django";
    if (fs.existsSync(path.join(projectPath, "requirements.txt"))) return "Python (Flask/Django possible)";
    return "Unknown";
  }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.next) return "Next.js";
  if (deps.nuxt || deps["nuxt3"]) return "Nuxt.js";
  if (deps.vite) return "Vite";
  if (deps.express) return "Express.js";
  if (deps.koa) return "Koa";
  if (deps.fastify) return "Fastify";
  if (deps["@nestjs/core"]) return "NestJS";
  if (deps.react || deps["react-dom"]) return "React";
  if (deps.vue) return "Vue.js";
  if (deps.angular || deps["@angular/core"]) return "Angular";
  if (deps.svelte) return "Svelte";
  return "Node.js (no major framework detected)";
};
