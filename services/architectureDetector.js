const path = require("path");
const fs = require("fs");

function flattenTree(node, prefix = "", list = []) {
  if (!node) return list;
  if (Array.isArray(node)) {
    node.forEach((n) => flattenTree(n, prefix, list));
    return list;
  }
  const name = node.name || node;
  if (typeof name === "string") {
    const full = prefix ? path.join(prefix, name) : name;
    list.push(full.replace(/\/$/, ""));
    if (node.children && node.children.length) {
      node.children.forEach((c) => flattenTree(c, full.replace(/\/$/, ""), list));
    }
  }
  return list;
}

function hasPathSegment(paths, segment) {
  const lower = segment.toLowerCase();
  return paths.some((p) => p.toLowerCase().includes(lower));
}

exports.detect = function detect(folderTree) {
  const flat = flattenTree(folderTree);
  const hasControllers = hasPathSegment(flat, "controllers");
  const hasModels = hasPathSegment(flat, "models");
  const hasViews = hasPathSegment(flat, "views");
  const hasRoutes = hasPathSegment(flat, "routes");
  const hasServices = hasPathSegment(flat, "services");
  const hasRepositories = hasPathSegment(flat, "repositories");
  const hasComponents = hasPathSegment(flat, "components");
  const hasPages = hasPathSegment(flat, "pages");
  const hasTraining = hasPathSegment(flat, "train") || hasPathSegment(flat, "training");
  const hasInference = hasPathSegment(flat, "inference") || hasPathSegment(flat, "infer");
  const hasData = hasPathSegment(flat, "data") || hasPathSegment(flat, "datasets");
  const hasPreprocess = hasPathSegment(flat, "preprocess");
  const multipleServices = flat.filter((p) => p.toLowerCase().includes("service") || p.toLowerCase().includes("api")).length > 2;

  if (hasTraining || hasInference) {
    if (hasData && (hasTraining || hasPreprocess)) return "ML pipeline";
  }
  if (hasData && (hasTraining || hasInference)) return "ML pipeline";

  if (multipleServices && (hasRoutes || hasControllers)) return "Microservices / Multi-service";

  if (hasControllers && hasModels && (hasViews || hasRoutes)) return "MVC";
  if (hasControllers && hasServices && (hasModels || hasRepositories)) return "Layered / Service-based";
  if (hasComponents && (hasPages || hasRoutes)) return "Component-based";
  if (hasRoutes && (hasControllers || hasModels)) return "Route-Controller-Model";
  if (hasControllers || hasModels || hasRoutes) return "Basic structured";
  if (hasComponents) return "Component-based";
  return "Basic / Flat";
};
