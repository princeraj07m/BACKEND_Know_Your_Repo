function treeToLines(node, indent = "") {
  if (!node) return [];
  const lines = [];
  if (Array.isArray(node)) {
    node.forEach((n) => lines.push(...treeToLines(n, indent)));
    return lines;
  }
  const name = node.name || "";
  lines.push(indent + name);
  if (node.children && node.children.length) {
    const nextIndent = indent + "  ";
    node.children.forEach((c) => lines.push(...treeToLines(c, nextIndent)));
  }
  return lines;
}

function treeToDisplayLines(node, indent = "") {
  if (!node) return [];
  const lines = [];
  if (Array.isArray(node)) {
    node.forEach((n) => lines.push(...treeToDisplayLines(n, indent)));
    return lines;
  }
  const prefix = node.type === "dir" ? "📁 " : "📄 ";
  const name = node.name || "";
  lines.push(indent + prefix + name);
  if (node.children && node.children.length) {
    const nextIndent = indent + "  ";
    node.children.forEach((c) => lines.push(...treeToDisplayLines(c, nextIndent)));
  }
  return lines;
}

exports.generate = function generate(data) {
  const { language, framework, architecture, entryPoint, routes, controllers, models, readmeSummary, folderTree } = data;
  const routeList = (routes || []).map((r) => `  ${r.method} ${r.path} → ${r.handler}`).join("\n");
  const controllerList = (controllers || []).map((c) => `  ${c.name} (${c.file}): ${(c.methods || []).join(", ")}`).join("\n");
  const modelList = (models || []).map((m) => `  ${m.name} (${m.file}): ${m.schemaSummary || "-"}`).join("\n");
  const treeLines = folderTree && folderTree.length ? treeToLines(folderTree).join("\n") : "(no tree)";

  let summary = `Language: ${language || "Unknown"}\nFramework: ${framework || "Unknown"}\nArchitecture: ${architecture || "Unknown"}\nEntry point: ${entryPoint || "Not detected"}\n`;
  if (readmeSummary) summary += "\nREADME excerpt:\n" + readmeSummary.slice(0, 500) + (readmeSummary.length > 500 ? "..." : "");

  let executionFlow = "1. Application starts from entry point (" + (entryPoint || "N/A") + ").\n";
  executionFlow += "2. Routes receive HTTP requests and map them to handlers.\n";
  if (routes && routes.length) executionFlow += "3. Route handlers (controllers) process business logic.\n";
  if (models && models.length) executionFlow += "4. Models interact with the database when needed.\n";
  executionFlow += "5. Response is sent back to the client.\n";
  if (routeList) executionFlow += "\nRoutes:\n" + routeList + "\n";
  if (controllerList) executionFlow += "\nControllers:\n" + controllerList + "\n";
  if (modelList) executionFlow += "\nModels:\n" + modelList + "\n";
  if (treeLines !== "(no tree)") executionFlow += "\nFolder structure:\n" + treeLines;

  const folderTreeText = folderTree && folderTree.length ? treeToDisplayLines(folderTree).join("\n") : "(no tree)";
  return { summary, executionFlow, folderTreeText };
};
