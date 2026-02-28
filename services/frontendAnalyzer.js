const fs = require("fs");
const path = require("path");

const COMPONENT_EXT = [".jsx", ".tsx", ".vue", ".js", ".ts"];
const PAGE_EXT = [".jsx", ".tsx", ".vue", ".js", ".ts"];
const COMPONENT_DIRS = ["components", "src/components", "src/Components", "components/ui", "src/components/ui"];
const PAGE_DIRS = ["pages", "src/pages", "app", "src/app", "views", "src/views"];
const ENTRY_CANDIDATES = ["src/main.jsx", "src/main.tsx", "src/main.js", "src/index.jsx", "src/index.tsx", "src/index.js", "src/App.jsx", "src/App.tsx", "index.jsx", "index.tsx", "main.jsx", "main.tsx"];

function readPackageJson(projectPath) {
  const p = path.join(projectPath, "package.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return [];
  }
}

function collectFiles(dir, basePath, extList, list, maxFiles) {
  if (!fs.existsSync(dir) || list.length >= maxFiles) return;
  const entries = safeReaddir(dir);
  for (const e of entries) {
    if (list.length >= maxFiles) break;
    const full = path.join(dir, e.name);
    const rel = path.relative(basePath, full).replace(/\\/g, "/");
    if (e.isDirectory() && !["node_modules", ".git", "dist", "build"].includes(e.name)) {
      collectFiles(full, basePath, extList, list, maxFiles);
    } else if (e.isFile() && extList.some((ext) => e.name.endsWith(ext))) {
      list.push(rel);
    }
  }
}

function detectFramework(rootPath) {
  const pkg = readPackageJson(rootPath);
  if (!pkg) return "Unknown";
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.next) return "Next.js";
  if (deps.nuxt || deps["nuxt3"]) return "Nuxt.js";
  if (deps.react || deps["react-dom"]) return "React";
  if (deps.vue) return "Vue.js";
  if (deps["@angular/core"]) return "Angular";
  if (deps.svelte) return "Svelte";
  if (deps.vite) return "Vite";
  return "Unknown";
}

function getEntryPoint(rootPath) {
  for (const c of ENTRY_CANDIDATES) {
    const full = path.join(rootPath, c);
    if (fs.existsSync(full)) return c;
  }
  const pkg = readPackageJson(rootPath);
  if (pkg && pkg.main) {
    const full = path.join(rootPath, pkg.main);
    if (fs.existsSync(full)) return pkg.main;
  }
  return "Not detected";
}

function getComponents(rootPath, maxFiles) {
  const list = [];
  const cap = maxFiles || 500;
  for (const d of COMPONENT_DIRS) {
    const full = path.join(rootPath, d);
    collectFiles(full, rootPath, COMPONENT_EXT, list, cap);
  }
  return list.slice(0, cap);
}

function getPages(rootPath, maxFiles) {
  const list = [];
  const cap = maxFiles || 300;
  for (const d of PAGE_DIRS) {
    const full = path.join(rootPath, d);
    if (!fs.existsSync(full)) continue;
    const entries = safeReaddir(full);
    for (const e of entries) {
      if (list.length >= cap) break;
      const fullPath = path.join(full, e.name);
      const rel = path.relative(rootPath, fullPath).replace(/\\/g, "/");
      if (e.isDirectory()) {
        const index = ["index.jsx", "index.tsx", "index.vue", "page.jsx", "page.tsx"].find((f) => fs.existsSync(path.join(fullPath, f)));
        if (index) list.push(path.join(rel, index).replace(/\\/g, "/"));
      } else if (e.isFile() && PAGE_EXT.some((ext) => e.name.endsWith(ext))) {
        list.push(rel);
      }
    }
  }
  return list.slice(0, cap);
}

function getRoutes(rootPath) {
  const routes = [];
  const pkg = readPackageJson(rootPath);
  const deps = { ...(pkg && pkg.dependencies), ...(pkg && pkg.devDependencies) };
  const isNext = deps && deps.next;
  if (isNext) {
    const pagesDir = path.join(rootPath, "pages");
    const appDir = path.join(rootPath, "app");
    const collect = (dir, prefix) => {
      if (!fs.existsSync(dir)) return;
      const entries = safeReaddir(dir);
      for (const e of entries) {
        const name = e.name;
        if (e.isDirectory() && name !== "api") {
          collect(path.join(dir, name), prefix + "/" + name);
        } else if (e.isFile() && (name.endsWith(".jsx") || name.endsWith(".tsx") || name.endsWith(".js") || name.endsWith(".ts"))) {
          const base = name.replace(/\.(jsx|tsx|js|ts)$/, "");
          const pathName = base === "index" ? prefix || "/" : (prefix + "/" + base);
          routes.push({ type: "Next.js file-based", path: pathName || "/", file: path.relative(rootPath, path.join(dir, name)).replace(/\\/g, "/") });
        }
      }
    };
    collect(pagesDir, "");
    if (fs.existsSync(appDir)) collect(appDir, "");
  }
  const srcPaths = [path.join(rootPath, "src"), rootPath];
  for (const src of srcPaths) {
    if (!fs.existsSync(src)) continue;
    try {
      const files = [];
      function walk(d) {
        const entries = safeReaddir(d);
        for (const e of entries) {
          if (e.isDirectory() && !["node_modules", ".git"].includes(e.name)) walk(path.join(d, e.name));
          else if (e.isFile() && (e.name.endsWith(".jsx") || e.name.endsWith(".ts") || e.name.endsWith(".js"))) files.push(path.join(d, e.name));
        }
      }
      walk(src);
      for (const f of files.slice(0, 100)) {
        const content = fs.readFileSync(f, "utf8").slice(0, 8000);
        if (content.includes("createBrowserRouter") || content.includes("BrowserRouter") || (content.includes("Routes") && content.includes("Route"))) {
          const pathMatch = content.match(/path\s*[:=]\s*["'`]([^"'`]+)["'`]/g);
          if (pathMatch && routes.length < 50) {
            pathMatch.forEach((m) => {
              const p = m.match(/["'`]([^"'`]+)["'`]/);
              if (p && !routes.some((r) => r.path === p[1])) routes.push({ type: "React Router", path: p[1], file: path.relative(rootPath, f).replace(/\\/g, "/") });
            });
          }
          break;
        }
      }
    } catch (e) {}
  }
  return routes.slice(0, 80);
}

function getStateManagement(rootPath) {
  const state = [];
  const pkg = readPackageJson(rootPath);
  const deps = { ...(pkg && pkg.dependencies), ...(pkg && pkg.devDependencies) } || {};
  if (deps.redux || deps["@reduxjs/toolkit"]) state.push("Redux");
  if (deps["react-redux"]) state.push("React-Redux");
  if (deps.mobx || deps["mobx-react"]) state.push("MobX");
  if (deps.zustand) state.push("Zustand");
  const srcPaths = [path.join(rootPath, "src"), rootPath];
  for (const src of srcPaths) {
    if (!fs.existsSync(src)) continue;
    try {
      const files = [];
      function walk(d, depth) {
        if (depth > 4) return;
        const entries = safeReaddir(d);
        for (const e of entries) {
          if (e.isDirectory() && !["node_modules", ".git"].includes(e.name)) walk(path.join(d, e.name), depth + 1);
          else if (e.isFile()) files.push(path.join(d, e.name));
        }
      }
      walk(src, 0);
      for (const f of files.slice(0, 80)) {
        const content = fs.readFileSync(f, "utf8").slice(0, 6000);
        if (content.includes("createContext") && !state.includes("Context API")) state.push("Context API");
        if ((content.includes("createStore") || content.includes("configureStore")) && !state.includes("Redux")) state.push("Redux");
      }
    } catch (e) {}
  }
  return state.length ? state : ["None detected"];
}

function getRenderMode(rootPath) {
  const pkg = readPackageJson(rootPath);
  const deps = { ...(pkg && pkg.dependencies), ...(pkg && pkg.devDependencies) } || {};
  if (deps.next) {
    const pagesDir = path.join(rootPath, "pages");
    let hasSSR = false;
    try {
      const walk = (d) => {
        const entries = safeReaddir(d);
        for (const e of entries) {
          if (e.isDirectory()) walk(path.join(d, e.name));
          else if (e.isFile()) {
            const c = fs.readFileSync(path.join(d, e.name), "utf8");
            if (c.includes("getServerSideProps") || c.includes("getStaticProps")) hasSSR = true;
          }
        }
      };
      if (fs.existsSync(pagesDir)) walk(pagesDir);
    } catch (e) {}
    return hasSSR ? "SSR" : "SPA (Next.js)";
  }
  if (deps.nuxt) return "SSR (Nuxt)";
  return "SPA";
}

exports.analyze = function analyze(projectPath, rootDir = ".") {
  try {
    const rootPath = rootDir === "." ? projectPath : path.join(projectPath, rootDir);
    if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
      return { framework: "Unknown", entryPoint: "Not detected", components: [], pages: [], routes: [], stateManagement: [], renderMode: "SPA", executionFlow: "" };
    }
    const framework = detectFramework(rootPath);
    const entryPoint = getEntryPoint(rootPath);
    const components = getComponents(rootPath);
    const pages = getPages(rootPath);
    const routes = getRoutes(rootPath);
    const stateManagement = getStateManagement(rootPath);
    const renderMode = getRenderMode(rootPath);

    let executionFlow = "1. Entry: " + entryPoint + " mounts the root component.\n";
    executionFlow += "2. Render mode: " + renderMode + ".\n";
    if (routes.length) executionFlow += "3. Routes (" + routes.length + "): navigation maps URLs to pages/components.\n";
    if (components.length) executionFlow += "4. Components (" + components.length + "): reusable UI pieces.\n";
    if (stateManagement.length && stateManagement[0] !== "None detected") executionFlow += "5. State: " + stateManagement.join(", ") + ".\n";
    executionFlow += "6. User interactions update state and re-render the UI.\n";

    return {
      framework,
      entryPoint,
      components,
      pages,
      routes,
      stateManagement,
      renderMode,
      executionFlow
    };
  } catch (err) {
    return { framework: "Unknown", entryPoint: "Not detected", components: [], pages: [], routes: [], stateManagement: [], renderMode: "SPA", executionFlow: "" };
  }
};
