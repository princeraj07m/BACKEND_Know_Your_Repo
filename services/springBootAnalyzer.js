const fs = require("fs");
const path = require("path");

const JAVA_DIRS = ["src/main/java", "src/main/kotlin", "src"];
const IGNORE_DIRS = new Set(["node_modules", ".git", "target", "build", "out", ".gradle"]);

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
    if (stat.size > (maxBytes || 500000)) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    return null;
  }
}

function isSpringBoot(projectPath) {
  const pomXml = path.join(projectPath, "pom.xml");
  const buildGradle = path.join(projectPath, "build.gradle");
  const buildGradleKts = path.join(projectPath, "build.gradle.kts");
  function checkPom(p) {
    if (!fs.existsSync(p)) return false;
    const c = safeReadFile(p);
    return c && (c.includes("spring-boot") || c.includes("spring-boot-starter"));
  }
  function checkGradle(p) {
    if (!fs.existsSync(p)) return false;
    const c = safeReadFile(p);
    return c && (c.includes("spring-boot") || c.includes("spring-boot-starter"));
  }
  return checkPom(pomXml) || checkGradle(buildGradle) || checkGradle(buildGradleKts);
}

function extractRoutes(content, sourceFile) {
  const routes = [];
  const classMatch = content.match(/@(?:RestController|Controller)\s*(?:\n|\s*\([^)]*\))?\s*(?:class|public\s+class)\s+(\w+)/);
  const className = classMatch ? classMatch[1] : "Unknown";
  const basePathRe = /@(?:RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*(?:\([^)]*value\s*=\s*["']([^"']+)["'][^)]*\)|\(["']([^"']+)["']\)|\(\))/g;
  const methodRe = /@(Get|Post|Put|Delete|Patch)Mapping\s*(?:\([^)]*value\s*=\s*["']([^"']+)["'][^)]*\)|\(["']([^"']+)["']\)|\(\))/g;
  const requestMappingRe = /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g;
  let basePath = "";
  let m;
  requestMappingRe.lastIndex = 0;
  while ((m = requestMappingRe.exec(content)) !== null) {
    basePath = m[1].replace(/\/$/, "");
  }
  const methodToUpper = { Get: "GET", Post: "POST", Put: "PUT", Delete: "DELETE", Patch: "PATCH" };
  methodRe.lastIndex = 0;
  while ((m = methodRe.exec(content)) !== null) {
    const method = methodToUpper[m[1]] || "GET";
    const pathVal = m[2] || m[3] || "/";
    const fullPath = basePath ? basePath + (pathVal.startsWith("/") ? pathVal : "/" + pathVal) : pathVal;
    routes.push({ method, path: fullPath, handler: className, sourceFile });
  }
  if (routes.length === 0) {
    basePathRe.lastIndex = 0;
    while ((m = basePathRe.exec(content)) !== null) {
      const p = m[1] || m[2] || "/";
      routes.push({ method: "GET", path: p, handler: className, sourceFile });
    }
  }
  return routes;
}

function collectJavaFiles(rootPath, basePath, max) {
  const files = [];
  function walk(dir) {
    if (files.length >= max) return;
    const entries = safeReaddir(dir);
    for (const e of entries) {
      if (files.length >= max) break;
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && /\.(java|kt)$/.test(e.name)) files.push({ path: path.relative(basePath, full).replace(/\\/g, "/"), full });
    }
  }
  walk(rootPath);
  return files;
}

function extractControllers(rootPath, basePath) {
  const list = [];
  const files = collectJavaFiles(rootPath, basePath, 200);
  for (const f of files.slice(0, 150)) {
    const content = safeReadFile(f.full, 80000);
    if (!content) continue;
    if (content.includes("@RestController") || content.includes("@Controller")) {
      const m = content.match(/(?:class|public\s+class)\s+(\w+)/);
      const name = m ? m[1] : path.basename(f.path, path.extname(f.path));
      const methods = [];
      const methodRe = /(?:public|private|protected)\s+(?:\w+(?:<[^>]+>)?\s+)?(\w+)\s*\(/g;
      let mm;
      while ((mm = methodRe.exec(content)) !== null) methods.push(mm[1]);
      list.push({ name, file: f.path, methods: methods.slice(0, 15) });
    }
  }
  return list;
}

function extractServices(rootPath, basePath) {
  const list = [];
  const files = collectJavaFiles(rootPath, basePath, 150);
  for (const f of files.slice(0, 100)) {
    const content = safeReadFile(f.full, 80000);
    if (!content || (!content.includes("@Service") && !content.includes("@Component"))) continue;
    const m = content.match(/(?:class|public\s+class)\s+(\w+)/);
    const name = m ? m[1] : path.basename(f.path, path.extname(f.path));
    list.push({ name, file: f.path });
  }
  return list;
}

function extractEntities(rootPath, basePath) {
  const list = [];
  const files = collectJavaFiles(rootPath, basePath, 150);
  for (const f of files.slice(0, 100)) {
    const content = safeReadFile(f.full, 80000);
    if (!content || !content.includes("@Entity")) continue;
    const m = content.match(/(?:class|public\s+class)\s+(\w+)/);
    const name = m ? m[1] : path.basename(f.path, path.extname(f.path));
    const fields = [];
    const fieldRe = /(?:private|protected)\s+\w+(?:<[^>]+>)?\s+(\w+)\s*;/g;
    let fm;
    while ((fm = fieldRe.exec(content)) !== null) fields.push(fm[1]);
    list.push({ name, file: f.path, schemaSummary: fields.length ? fields.join(", ") : "Entity" });
  }
  return list;
}

function readApplicationProps(projectPath) {
  const candidates = [
    path.join(projectPath, "src/main/resources/application.properties"),
    path.join(projectPath, "src/main/resources/application.yml"),
    path.join(projectPath, "application.properties"),
    path.join(projectPath, "application.yml")
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const c = safeReadFile(p, 20000);
    if (!c) continue;
    const lines = c.split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).slice(0, 30);
    return lines.join("\n");
  }
  return null;
}

exports.analyze = function analyze(projectPath, rootDir = ".") {
  const rootPath = rootDir === "." ? projectPath : path.join(projectPath, rootDir);
  if (!isSpringBoot(rootPath)) {
    return { isSpringBoot: false, routes: [], controllers: [], services: [], entities: [], applicationConfig: null };
  }
  let javaRoot = rootPath;
  for (const d of JAVA_DIRS) {
    const p = path.join(rootPath, d);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      javaRoot = p;
      break;
    }
  }
  const routes = [];
  const files = collectJavaFiles(javaRoot, rootPath, 250);
  for (const f of files.slice(0, 200)) {
    const content = safeReadFile(f.full, 80000);
    if (!content) continue;
    const r = extractRoutes(content, f.path);
    routes.push(...r);
  }
  const controllers = extractControllers(javaRoot, rootPath);
  const services = extractServices(javaRoot, rootPath);
  const entities = extractEntities(javaRoot, rootPath);
  const applicationConfig = readApplicationProps(rootPath);
  return {
    isSpringBoot: true,
    routes: [...new Map(routes.map(r => [`${r.method}:${r.path}`, r])).values()].sort((a, b) => (a.sourceFile || "").localeCompare(b.sourceFile || "")),
    controllers,
    services,
    entities,
    models: entities,
    applicationConfig
  };
};
