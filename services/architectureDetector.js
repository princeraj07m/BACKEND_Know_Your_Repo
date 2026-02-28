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

  if (hasControllers && hasModels && (hasViews || hasRoutes)) return "MVC";
  if (hasControllers && hasServices && (hasModels || hasRepositories)) return "Layered / Service-based";
  if (hasRoutes && (hasControllers || hasModels)) return "Route-Controller-Model";
  if (hasControllers || hasModels || hasRoutes) return "Basic structured";
  return "Basic / Flat";
};
