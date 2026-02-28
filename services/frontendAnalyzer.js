const fs = require("fs");
const path = require("path");

const COMPONENT_EXT = [".jsx", ".tsx", ".vue", ".js", ".ts"];
const PAGE_EXT = [".jsx", ".tsx", ".vue", ".js", ".ts"];
const COMPONENT_DIRS = ["components", "src/components", "src/Components", "components/ui", "src/components/ui"];
const PAGE_DIRS = ["pages", "src/pages", "app", "src/app", "views", "src/views"];
const ENTRY_CANDIDATES = ["src/main.jsx", "src/main.tsx", "src/main.js", "src/index.jsx", "src/index.tsx", "src/index.js", "src/App.jsx", "src/App.tsx", "index.jsx", "index.tsx", "main.jsx", "main.tsx"];
const MAX_READ_SIZE = 1024 * 1024;
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".cache"]);

function readPackageJson(rootPath) {
  const p = path.join(rootPath, "package.json");
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

function safeReadFile(filePath, maxBytes) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > (maxBytes || MAX_READ_SIZE)) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    return null;
  }
}

function collectFiles(dir, basePath, extList, list, maxFiles) {
  if (!fs.existsSync(dir) || list.length >= maxFiles) return;
  const entries = safeReaddir(dir);
  for (const e of entries) {
    if (list.length >= maxFiles) break;
    if (IGNORE_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(basePath, full).replace(/\\/g, "/");
    if (e.isDirectory()) collectFiles(full, basePath, extList, list, maxFiles);
    else if (e.isFile() && extList.some((ext) => e.name.endsWith(ext))) list.push(rel);
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
      } else if (e.isFile() && PAGE_EXT.some((ext) => e.name.endsWith(ext))) list.push(rel);
    }
  }
  return list.slice(0, cap);
}

function extractReactRoutes(rootPath) {
  const routes = [];
  const seen = new Set();
  const srcPaths = [path.join(rootPath, "src"), rootPath];
  for (const src of srcPaths) {
    if (!fs.existsSync(src)) continue;
    const files = [];
    function walk(d, depth) {
      if (depth > 6) return;
      const entries = safeReaddir(d);
      for (const e of entries) {
        if (e.isDirectory() && !IGNORE_DIRS.has(e.name)) walk(path.join(d, e.name), depth + 1);
        else if (e.isFile() && /\.(jsx?|tsx?)$/.test(e.name)) files.push(path.join(d, e.name));
      }
    }
    walk(src, 0);
    for (const f of files.slice(0, 150)) {
      const content = safeReadFile(f, 12000);
      if (!content) continue;
      const rel = path.relative(rootPath, f).replace(/\\/g, "/");
      if (content.includes("<Route") && content.includes("path=")) {
        const pathRe = /<Route\s+[^>]*path\s*=\s*{?["'`]([^"'`]+)["'`]}?[^>]*\/?>/g;
        let m;
        while ((m = pathRe.exec(content)) !== null && routes.length < 80) {
          const p = m[1].trim();
          if (!seen.has(p)) { seen.add(p); routes.push({ type: "React Router (Route)", path: p, component: "", file: rel }); }
        }
        const pathRe2 = /path\s*:\s*["'`]([^"'`]+)["'`]/g;
        while ((m = pathRe2.exec(content)) !== null && routes.length < 80) {
          const p = m[1].trim();
          if (!seen.has(p)) { seen.add(p); routes.push({ type: "React Router", path: p, component: "", file: rel }); }
        }
      }
      if (content.includes("createBrowserRouter") || content.includes("createRoutesFromElements")) {
        const pathRe = /path\s*:\s*["'`]([^"'`]+)["'`]/g;
        let m;
        while ((m = pathRe.exec(content)) !== null && routes.length < 80) {
          const p = m[1].trim();
          if (!seen.has(p)) { seen.add(p); routes.push({ type: "React Router (createBrowserRouter)", path: p, component: "", file: rel }); }
        }
      }
      if (content.includes("useRoutes(")) {
        const pathRe = /path\s*:\s*["'`]([^"'`]+)["'`]/g;
        let m;
        while ((m = pathRe.exec(content)) !== null && routes.length < 80) {
          const p = m[1].trim();
          if (!seen.has(p)) { seen.add(p); routes.push({ type: "React Router (useRoutes)", path: p, component: "", file: rel }); }
        }
      }
    }
  }
  return routes.slice(0, 80);
}

function extractNextRoutes(rootPath) {
  const routes = [];
  const pagesDir = path.join(rootPath, "pages");
  const appDir = path.join(rootPath, "app");
  function collect(dir, prefix, root) {
    if (!fs.existsSync(dir)) return;
    const entries = safeReaddir(dir);
    for (const e of entries) {
      const name = e.name;
      if (e.isDirectory() && name !== "api" && name !== "_app" && name !== "_document") {
        const segment = name.startsWith("[") ? ":" + name.replace(/^\[\.\.\.?(\w+)\]$/, "$1") : name;
        collect(path.join(dir, name), prefix + "/" + segment, root);
      } else if (e.isFile() && /\.(jsx?|tsx?)$/.test(name)) {
        const base = name.replace(/\.(jsx|tsx|js|ts)$/, "");
        const pathName = base === "index" ? (prefix || "/") : (prefix + "/" + (base.startsWith("[") ? ":" + base.replace(/^\[\.\.\.?(\w+)\]$/, "$1") : base));
        routes.push({ type: "Next.js (Pages)", path: pathName || "/", component: base, file: path.relative(root, path.join(dir, name)).replace(/\\/g, "/"), dynamic: name.startsWith("[") });
      }
    }
  }
  collect(pagesDir, "", rootPath);
  if (fs.existsSync(appDir)) {
    const appEntries = safeReaddir(appDir);
    for (const e of appEntries) {
      if (e.isDirectory()) {
        const dirName = e.name;
        const segment = dirName.startsWith("(") ? "" : (dirName.startsWith("[") ? ":" + dirName.replace(/^\[\.\.\.?(\w+)\]$/, "$1") : dirName);
        const pagePath = path.join(appDir, dirName, "page.js");
        const pageTsx = path.join(appDir, dirName, "page.tsx");
        const pageJs = path.join(appDir, dirName, "page.jsx");
        const pageFile = fs.existsSync(pageTsx) ? pageTsx : (fs.existsSync(pageJs) ? pageJs : pagePath);
        if (fs.existsSync(pageFile)) {
          const p = segment ? "/" + segment : "/";
          routes.push({ type: "Next.js (App Router)", path: p, component: dirName, file: path.relative(rootPath, pageFile).replace(/\\/g, "/"), dynamic: dirName.startsWith("[") });
        }
      }
    }
  }
  return routes;
}

function extractAngularRoutes(rootPath) {
  const routes = [];
  const srcPath = path.join(rootPath, "src");
  const files = [];
  function walk(d, depth) {
    if (depth > 5) return;
    const entries = safeReaddir(d);
    for (const e of entries) {
      if (e.isDirectory() && !IGNORE_DIRS.has(e.name)) walk(path.join(d, e.name), depth + 1);
      else if (e.isFile() && (e.name.includes("routing") || e.name === "app-routing.module.ts")) files.push(path.join(d, e.name));
    }
  }
  walk(rootPath, 0);
  if (fs.existsSync(srcPath)) walk(srcPath, 0);
  for (const f of files) {
    const content = safeReadFile(f, 15000);
    if (!content) continue;
    const rel = path.relative(rootPath, f).replace(/\\/g, "/");
    const pathRe = /path\s*:\s*["'`]([^"'`]+)["'`]\s*,\s*component\s*:\s*(\w+)/g;
    let m;
    while ((m = pathRe.exec(content)) !== null && routes.length < 60) {
      routes.push({ type: "Angular", path: m[1], component: m[2], file: rel });
    }
    const lazyRe = /path\s*:\s*["'`]([^"'`]+)["'`]\s*,\s*loadChildren\s*:/g;
    while ((m = lazyRe.exec(content)) !== null && routes.length < 60) {
      routes.push({ type: "Angular (lazy)", path: m[1], component: "(lazy)", file: rel });
    }
  }
  return routes;
}

function extractVueRoutes(rootPath) {
  const routes = [];
  const routerPaths = [path.join(rootPath, "src/router"), path.join(rootPath, "router")];
  for (const routerDir of routerPaths) {
    if (!fs.existsSync(routerDir)) continue;
    const entries = safeReaddir(routerDir);
    for (const e of entries) {
      if (!e.isFile() || !/\.(js|ts)$/.test(e.name)) continue;
      const f = path.join(routerDir, e.name);
      const content = safeReadFile(f, 20000);
      if (!content) continue;
      const rel = path.relative(rootPath, f).replace(/\\/g, "/");
      const pathRe = /path\s*:\s*["'`]([^"'`]+)["'`]\s*,\s*name\s*:\s*["'`]?(\w+)["'`]?/g;
      let m;
      while ((m = pathRe.exec(content)) !== null && routes.length < 60) {
        routes.push({ type: "Vue Router", path: m[1], component: m[2], file: rel });
      }
      const pathRe2 = /path\s*:\s*["'`]([^"'`]+)["'`]\s*,\s*component\s*:\s*(\w+)/g;
      while ((m = pathRe2.exec(content)) !== null && routes.length < 60) {
        routes.push({ type: "Vue Router", path: m[1], component: m[2], file: rel });
      }
      const pathRe3 = /path\s*:\s*["'`]([^"'`]+)["'`]/g;
      while ((m = pathRe3.exec(content)) !== null && routes.length < 60) {
        if (!routes.some((r) => r.path === m[1])) routes.push({ type: "Vue Router", path: m[1], component: "", file: rel });
      }
      if (content.includes("children") && content.includes("routes")) {
        const childrenRe = /children\s*:\s*\[([^\]]+)\]/g;
        let cm;
        while ((cm = childrenRe.exec(content)) !== null) {
          const pathInChild = cm[1].match(/path\s*:\s*["'`]([^"'`]+)["'`]/g);
          if (pathInChild) pathInChild.forEach((s) => { const p = s.match(/["'`]([^"'`]+)["'`]/); if (p && routes.length < 60) routes.push({ type: "Vue Router (child)", path: p[1], component: "", file: rel }); });
        }
      }
    }
  }
  return routes.slice(0, 60);
}

function getRoutes(rootPath) {
  const pkg = readPackageJson(rootPath);
  const deps = { ...(pkg && pkg.dependencies), ...(pkg && pkg.devDependencies) } || {};
  if (deps.next) return extractNextRoutes(rootPath);
  if (deps["@angular/core"]) return extractAngularRoutes(rootPath);
  if (deps.vue) return extractVueRoutes(rootPath);
  if (deps.react || deps["react-dom"]) {
    const r = extractReactRoutes(rootPath);
    return r.length ? r : extractNextRoutes(rootPath);
  }
  const reactRoutes = extractReactRoutes(rootPath);
  return reactRoutes.length ? reactRoutes : extractNextRoutes(rootPath);
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
          if (e.isDirectory() && !IGNORE_DIRS.has(e.name)) walk(path.join(d, e.name), depth + 1);
          else if (e.isFile()) files.push(path.join(d, e.name));
        }
      }
      walk(src, 0);
      for (const f of files.slice(0, 80)) {
        const content = safeReadFile(f, 6000);
        if (content && content.includes("createContext") && !state.includes("Context API")) state.push("Context API");
        if (content && (content.includes("createStore") || content.includes("configureStore")) && !state.includes("Redux")) state.push("Redux");
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
    let hasCSR = false;
    try {
      function walk(d) {
        const entries = safeReaddir(d);
        for (const e of entries) {
          if (e.isDirectory()) walk(path.join(d, e.name));
          else if (e.isFile()) {
            const c = safeReadFile(path.join(d, e.name), 5000);
            if (c) {
              if (c.includes("getServerSideProps") || c.includes("getStaticProps")) hasSSR = true;
              else hasCSR = true;
            }
          }
        }
      }
      if (fs.existsSync(pagesDir)) walk(pagesDir);
    } catch (e) {}
    return hasSSR ? "SSR" : (hasCSR ? "CSR" : "SPA (Next.js)");
  }
  if (deps.nuxt) return "SSR (Nuxt)";
  return "SPA";
}

exports.analyze = function analyze(projectPath, rootDir) {
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
