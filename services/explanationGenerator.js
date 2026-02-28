function treeToLines(node, indent) {
  indent = indent || "";
  if (!node) return [];
  const lines = [];
  if (Array.isArray(node)) {
    node.forEach(function (n) {
      lines.push.apply(lines, treeToLines(n, indent));
    });
    return lines;
  }
  const name = node.name || "";
  lines.push(indent + name);
  if (node.children && node.children.length) {
    const nextIndent = indent + "  ";
    node.children.forEach(function (c) {
      lines.push.apply(lines, treeToLines(c, nextIndent));
    });
  }
  return lines;
}

function treeToDisplayLines(node, indent) {
  indent = indent || "";
  if (!node) return [];
  const lines = [];
  if (Array.isArray(node)) {
    node.forEach(function (n) {
      lines.push.apply(lines, treeToDisplayLines(n, indent));
    });
    return lines;
  }
  const prefix = node.type === "dir" ? "📁 " : "📄 ";
  const name = node.name || "";
  lines.push(indent + prefix + name);
  if (node.children && node.children.length) {
    const nextIndent = indent + "  ";
    node.children.forEach(function (c) {
      lines.push.apply(lines, treeToDisplayLines(c, nextIndent));
    });
  }
  return lines;
}

function backendFlow(backendModules, flat) {
  const routes = flat && flat.routes ? flat.routes : (backendModules[0] && backendModules[0].routes) || [];
  const controllers = flat && flat.controllers ? flat.controllers : (backendModules[0] && backendModules[0].controllers) || [];
  const models = flat && flat.models ? flat.models : (backendModules[0] && backendModules[0].models) || [];
  const entryPoint = flat && flat.entryPoint ? flat.entryPoint : (backendModules[0] && backendModules[0].entryPoint) || "N/A";
  let out = "1. Application starts from entry point (" + entryPoint + ").\n";
  out += "2. Routes receive HTTP requests and map them to handlers.\n";
  if (routes.length) out += "3. Route handlers (controllers) process business logic.\n";
  if (models.length) out += "4. Models interact with the database when needed.\n";
  out += "5. Response is sent back to the client.\n";
  if (routes.length) out += "\nRoutes:\n" + routes.map(function (r) { return "  " + (r.method || "") + " " + (r.path || "") + " → " + (r.handler || ""); }).join("\n") + "\n";
  if (controllers.length) out += "\nControllers:\n" + controllers.map(function (c) { return "  " + (c.name || "") + " (" + (c.file || "") + "): " + (c.methods || []).join(", "); }).join("\n") + "\n";
  if (models.length) out += "\nModels:\n" + models.map(function (m) { return "  " + (m.name || "") + " (" + (m.file || "") + "): " + (m.schemaSummary || "-"); }).join("\n") + "\n";
  return out;
}

function frontendFlow(frontendModules) {
  const m = frontendModules[0];
  if (!m) return "Frontend: no module analyzed.\n";
  let out = "Frontend execution flow:\n";
  out += "Browser → Router → Component → API (if any) → State Update → UI Render\n\n";
  out += m.executionFlow || "";
  if (m.routes && m.routes.length) {
    out += "\nFrontend routes:\n";
    m.routes.slice(0, 30).forEach(function (r) {
      out += "  " + (r.path || "") + " → " + (r.component || r.file || "") + " (" + (r.type || "") + ")\n";
    });
    if (m.routes.length > 30) out += "  ... and " + (m.routes.length - 30) + " more\n";
  }
  return out;
}

function fullstackFlowText() {
  return "Fullstack execution flow:\nBrowser → Frontend Router → API Call → Backend Route → Controller → DB → Response → UI\n";
}

function frontendOnlyFlowText() {
  return "Frontend execution flow:\nBrowser → Router → Component → API → State Update → UI Render\n";
}

function mlFlowText() {
  return "ML pipeline: Dataset → Preprocessing → Model Training → Evaluation → Inference\n";
}

function mlFlow(mlModules) {
  const m = mlModules[0];
  if (!m || !m.pipelineExplanation) return "ML: Data → Preprocessing → Training → Evaluation → Inference.\n";
  return m.pipelineExplanation;
}

function integrationFlow(backendModules, frontendModules) {
  let out = fullstackFlowText();
  out += "\nIntegration flow:\n";
  out += "1. User interacts with frontend (SPA/SSR).\n";
  out += "2. Frontend calls backend APIs (REST/GraphQL etc.).\n";
  out += "3. Backend processes request, uses DB/services, returns response.\n";
  out += "4. Frontend updates UI from response.\n";
  if (backendModules.length && backendModules[0].routes && backendModules[0].routes.length) {
    out += "\nBackend routes (sample): " + backendModules[0].routes.slice(0, 8).map(function (r) { return r.method + " " + r.path; }).join(", ") + "\n";
  }
  if (frontendModules.length && frontendModules[0].routes && frontendModules[0].routes.length) {
    out += "\nFrontend routes (sample): " + frontendModules[0].routes.slice(0, 8).map(function (r) { return r.path; }).join(", ") + "\n";
  }
  return out;
}

exports.generate = function generate(data) {
  const projectType = data.projectType || "Backend Only";
  const monorepo = data.monorepoResult;
  const backendModules = (monorepo && monorepo.backendModules) || [];
  const frontendModules = (monorepo && monorepo.frontendModules) || [];
  const mlModules = (monorepo && monorepo.mlModules) || [];
  const language = data.language || "Unknown";
  const framework = data.framework || (backendModules[0] && backendModules[0].framework) || (frontendModules[0] && frontendModules[0].framework) || "Unknown";
  const architecture = data.architecture || (backendModules[0] && backendModules[0].architecture) || "Unknown";
  const entryPoint = data.entryPoint || (backendModules[0] && backendModules[0].entryPoint) || (frontendModules[0] && frontendModules[0].entryPoint) || "Not detected";
  const routes = data.routes || (backendModules[0] && backendModules[0].routes) || [];
  const controllers = data.controllers || (backendModules[0] && backendModules[0].controllers) || [];
  const models = data.models || (backendModules[0] && backendModules[0].models) || [];
  const readmeSummary = data.readmeSummary;
  let folderTree = data.folderTree;

  if (!folderTree && backendModules[0] && backendModules[0].folderTree) folderTree = backendModules[0].folderTree;
  if (!folderTree && frontendModules[0] && frontendModules[0].folderTree) folderTree = frontendModules[0].folderTree;

  const treeLines = folderTree && folderTree.length ? treeToLines(folderTree).join("\n") : "(no tree)";
  const routeList = (routes || []).map(function (r) { return "  " + (r.method || "") + " " + (r.path || "") + " → " + (r.handler || ""); }).join("\n");
  const controllerList = (controllers || []).map(function (c) { return "  " + (c.name || "") + " (" + (c.file || "") + "): " + (c.methods || []).join(", "); }).join("\n");
  const modelList = (models || []).map(function (m) { return "  " + (m.name || "") + " (" + (m.file || "") + "): " + (m.schemaSummary || "-"); }).join("\n");

  let summary = "Project type: " + projectType + "\n";
  summary += "Language: " + language + "\n";
  summary += "Framework: " + framework + "\n";
  summary += "Architecture: " + architecture + "\n";
  summary += "Entry point: " + entryPoint + "\n";
  if (monorepo && monorepo.isMonorepo) {
    summary += "Monorepo: frontend roots " + (monorepo.frontendRoots || []).join(", ") + "; backend roots " + (monorepo.backendRoots || []).join(", ") + "; ML roots " + (monorepo.mlRoots || []).join(", ") + "\n";
  }
  if (frontendModules.length) {
    const fe = frontendModules[0];
    summary += "Frontend: " + (fe.framework || "-") + ", " + (fe.renderMode || "SPA") + ", components " + (fe.components && fe.components.length) + ", pages " + (fe.pages && fe.pages.length) + "\n";
  }
  if (mlModules.length && mlModules[0].libs && mlModules[0].libs.length) {
    summary += "ML libs: " + mlModules[0].libs.join(", ") + "\n";
  }
  if (readmeSummary) summary += "\nREADME excerpt:\n" + readmeSummary.slice(0, 500) + (readmeSummary.length > 500 ? "..." : "");

  let executionFlow = "";
  if (projectType === "Backend Only" || (projectType === "Fullstack" && backendModules.length)) {
    executionFlow += "--- Backend ---\n" + backendFlow(backendModules, { routes, controllers, models, entryPoint });
  }
  if (projectType === "Frontend Only") {
    executionFlow += "--- Frontend ---\n" + frontendOnlyFlowText() + frontendFlow(frontendModules);
  } else if ((projectType === "Fullstack" && frontendModules.length) || (projectType === "Monorepo" && frontendModules.length)) {
    executionFlow += "--- Frontend ---\n" + frontendFlow(frontendModules);
  }
  if (projectType === "ML Project" || (projectType === "Monorepo" && mlModules.length) || (projectType === "Fullstack" && mlModules.length)) {
    executionFlow += "--- ML pipeline ---\n" + mlFlowText() + mlFlow(mlModules);
  }
  if ((projectType === "Fullstack" || projectType === "Monorepo") && backendModules.length && frontendModules.length) {
    executionFlow += "--- " + integrationFlow(backendModules, frontendModules);
  }
  if (!executionFlow) {
    executionFlow = "1. Application starts from entry point (" + entryPoint + ").\n";
    executionFlow += "2. Routes receive HTTP requests and map them to handlers.\n";
    if (routes.length) executionFlow += "3. Route handlers (controllers) process business logic.\n";
    if (models.length) executionFlow += "4. Models interact with the database when needed.\n";
    executionFlow += "5. Response is sent back to the client.\n";
    if (routeList) executionFlow += "\nRoutes:\n" + routeList + "\n";
    if (controllerList) executionFlow += "\nControllers:\n" + controllerList + "\n";
    if (modelList) executionFlow += "\nModels:\n" + modelList + "\n";
  }
  if (treeLines !== "(no tree)") executionFlow += "\nFolder structure:\n" + treeLines;

  const folderTreeText = folderTree && folderTree.length ? treeToDisplayLines(folderTree).join("\n") : "(no tree)";
  return { summary, executionFlow, folderTreeText };
};
