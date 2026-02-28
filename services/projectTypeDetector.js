const fs = require("fs");
const path = require("path");

const FRONTEND_ROOTS = ["client", "frontend", "web", "apps/web", "packages/web"];
const BACKEND_ROOTS = ["server", "api", "backend", "apps/api", "packages/api"];

function readPackageJson(projectPath) {
  const p = path.join(projectPath, "package.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function hasBackendIndicators(projectPath) {
  const pkg = readPackageJson(projectPath);
  if (!pkg) return false;
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.express || deps.koa || deps.fastify || deps["@nestjs/core"]) return true;
  const dirs = ["routes", "controllers", "models", "app.js", "server.js", "index.js"];
  return dirs.some((d) => {
    const full = path.join(projectPath, d);
    return fs.existsSync(full);
  });
}

function hasFrontendIndicators(projectPath) {
  const pkg = readPackageJson(projectPath);
  if (!pkg) return false;
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.react || deps.vue || deps["@angular/core"] || deps.next || deps.svelte) return true;
  const dirs = ["src", "components", "pages", "app"];
  return dirs.some((d) => fs.existsSync(path.join(projectPath, d)));
}

function hasMLIndicators(projectPath) {
  if (fs.existsSync(path.join(projectPath, "requirements.txt")) || fs.existsSync(path.join(projectPath, "pyproject.toml"))) return true;
  const files = fs.readdirSync(projectPath, { withFileTypes: true });
  return files.some((f) => f.name.endsWith(".ipynb") || (f.isFile() && f.name.toLowerCase().includes("train") && f.name.endsWith(".py")));
}

function getRootDirs(projectPath) {
  try {
    const entries = fs.readdirSync(projectPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && !["node_modules", ".git", "dist", "build", "vendor", "__pycache__"].includes(e.name)).map((e) => e.name);
  } catch (e) {
    return [];
  }
}

exports.detect = function detect(projectPath) {
  try {
    const rootDirs = getRootDirs(projectPath);
    const hasPackageJson = fs.existsSync(path.join(projectPath, "package.json"));
    const hasRequirements = fs.existsSync(path.join(projectPath, "requirements.txt")) || fs.existsSync(path.join(projectPath, "pyproject.toml"));
    const hasNotebooks = (() => {
      try {
        const names = fs.readdirSync(projectPath);
        if (names.some((n) => n.endsWith(".ipynb"))) return true;
        const subdirs = names.filter((n) => {
          const p = path.join(projectPath, n);
          return fs.statSync(p).isDirectory() && !["node_modules", ".git"].includes(n);
        });
        for (const d of subdirs.slice(0, 5)) {
          const sub = fs.readdirSync(path.join(projectPath, d));
          if (sub.some((f) => f.endsWith(".ipynb"))) return true;
        }
      } catch (e) {}
      return false;
    })();

    const frontendRoots = [];
    const backendRoots = [];
    const mlRoots = [];

    for (const name of FRONTEND_ROOTS) {
      const full = path.join(projectPath, name);
      if (fs.existsSync(full) && fs.statSync(full).isDirectory()) frontendRoots.push(name);
    }
    for (const name of BACKEND_ROOTS) {
      const full = path.join(projectPath, name);
      if (fs.existsSync(full) && fs.statSync(full).isDirectory()) backendRoots.push(name);
    }

    const isMonorepo = frontendRoots.length + backendRoots.length >= 2 || (frontendRoots.length >= 1 && backendRoots.length >= 1);
    const rootAtProject = hasPackageJson && (hasBackendIndicators(projectPath) || hasFrontendIndicators(projectPath));

    if (hasRequirements || hasNotebooks || hasMLIndicators(projectPath)) {
      mlRoots.push(".");
    }
    if (rootAtProject && !isMonorepo) {
      if (hasBackendIndicators(projectPath) && !hasFrontendIndicators(projectPath)) {
        return { projectType: "Backend Only", frontendRoots: [], backendRoots: ["."], mlRoots: [], isMonorepo: false };
      }
      if (hasFrontendIndicators(projectPath) && !hasBackendIndicators(projectPath)) {
        return { projectType: "Frontend Only", frontendRoots: ["."], backendRoots: [], mlRoots: [], isMonorepo: false };
      }
      if (hasBackendIndicators(projectPath) && hasFrontendIndicators(projectPath)) {
        return { projectType: "Fullstack", frontendRoots: ["."], backendRoots: ["."], mlRoots: mlRoots.length ? ["."] : [], isMonorepo: false };
      }
    }

    if (isMonorepo) {
      const hasML = mlRoots.length > 0 || hasMLIndicators(projectPath);
      return {
        projectType: "Monorepo",
        frontendRoots: frontendRoots.length ? frontendRoots : (hasFrontendIndicators(projectPath) ? ["."] : []),
        backendRoots: backendRoots.length ? backendRoots : (hasBackendIndicators(projectPath) ? ["."] : []),
        mlRoots: hasML ? ["."] : [],
        isMonorepo: true
      };
    }

    if (hasRequirements || hasNotebooks) {
      return { projectType: "ML Project", frontendRoots: [], backendRoots: [], mlRoots: ["."], isMonorepo: false };
    }

    if (hasBackendIndicators(projectPath)) {
      return { projectType: "Backend Only", frontendRoots: [], backendRoots: ["."], mlRoots: [], isMonorepo: false };
    }
    if (hasFrontendIndicators(projectPath)) {
      return { projectType: "Frontend Only", frontendRoots: ["."], backendRoots: [], mlRoots: [], isMonorepo: false };
    }

    return { projectType: "Unknown", frontendRoots: [], backendRoots: [], mlRoots: [], isMonorepo: false };
  } catch (err) {
    return { projectType: "Unknown", frontendRoots: [], backendRoots: [], mlRoots: [], isMonorepo: false };
  }
};
