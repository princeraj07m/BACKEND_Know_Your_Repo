const path = require("path");
const fs = require("fs");
const projectTypeDetector = require("./projectTypeDetector");
const routeAnalyzer = require("./routeAnalyzer");
const controllerAnalyzer = require("./controllerAnalyzer");
const modelAnalyzer = require("./modelAnalyzer");
const frameworkDetector = require("./frameworkDetector");
const architectureDetector = require("./architectureDetector");
const entryPointDetector = require("./entryPointDetector");
const frontendAnalyzer = require("./frontendAnalyzer");
const mlAnalyzer = require("./mlAnalyzer");
const fileScanner = require("./fileScannerService");

function analyzeBackend(projectPath, rootDir) {
  const rootPath = rootDir === "." ? projectPath : path.join(projectPath, rootDir);
  const folderTree = fileScanner.scanRoot(projectPath, rootDir);
  const architecture = architectureDetector.detect(folderTree);
  return {
    root: rootDir,
    framework: frameworkDetector.detect(rootPath),
    architecture,
    entryPoint: entryPointDetector.getEntryPoint(rootPath),
    routes: routeAnalyzer.analyze(rootPath),
    controllers: controllerAnalyzer.analyze(rootPath),
    models: modelAnalyzer.analyze(rootPath),
    folderTree
  };
}

function analyzeFrontend(projectPath, rootDir) {
  return {
    root: rootDir,
    ...frontendAnalyzer.analyze(projectPath, rootDir)
  };
}

function analyzeML(projectPath, rootDir) {
  return {
    root: rootDir,
    ...mlAnalyzer.analyze(projectPath, rootDir)
  };
}

exports.analyze = function analyze(projectPath) {
  try {
    const typeResult = projectTypeDetector.detect(projectPath);
    const projectType = typeResult.projectType;
    const frontendRoots = typeResult.frontendRoots || [];
    const backendRoots = typeResult.backendRoots || [];
    const mlRoots = typeResult.mlRoots || [];
    const isMonorepo = typeResult.isMonorepo === true;

    const backendModules = [];
    const frontendModules = [];
    const mlModules = [];

    for (const root of backendRoots) {
      try {
        backendModules.push(analyzeBackend(projectPath, root));
      } catch (e) {
        backendModules.push({ root, error: e.message });
      }
    }
    for (const root of frontendRoots) {
      try {
        frontendModules.push(analyzeFrontend(projectPath, root));
      } catch (e) {
        frontendModules.push({ root, error: e.message });
      }
    }
    for (const root of mlRoots) {
      try {
        const ml = analyzeML(projectPath, root);
        if (ml.hasPython || ml.hasNotebooks || ml.libs.length) mlModules.push(ml);
      } catch (e) {
        mlModules.push({ root, error: e.message });
      }
    }

    return {
      projectType,
      isMonorepo,
      frontendRoots,
      backendRoots,
      mlRoots,
      backendModules,
      frontendModules,
      mlModules
    };
  } catch (err) {
    return {
      projectType: "Unknown",
      isMonorepo: false,
      frontendRoots: [],
      backendRoots: [],
      mlRoots: [],
      backendModules: [],
      frontendModules: [],
      mlModules: []
    };
  }
};
