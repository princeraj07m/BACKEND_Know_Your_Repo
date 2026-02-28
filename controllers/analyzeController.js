const gitService = require("../services/gitService");
const fileScanner = require("../services/fileScannerService");
const frameworkDetector = require("../services/frameworkDetector");
const architectureDetector = require("../services/architectureDetector");
const entryPointDetector = require("../services/entryPointDetector");
const routeAnalyzer = require("../services/routeAnalyzer");
const controllerAnalyzer = require("../services/controllerAnalyzer");
const modelAnalyzer = require("../services/modelAnalyzer");
const readmeService = require("../services/readmeService");
const explanationGenerator = require("../services/explanationGenerator");
const monorepoAnalyzer = require("../services/monorepoAnalyzer");
const analysisTimeout = require("../services/analysisTimeout");
const projectTypeDetector = require("../services/projectTypeDetector");
const AnalysisReport = require("../models/AnalysisReport");
const Repository = require("../models/Repository");

const wantsJson = (req) =>
  req._forceJson === true ||
  req.query.format === "json" ||
  req.accepts("application/json") ||
  req.get("X-Requested-With") === "XMLHttpRequest";

function buildJsonPayload(data, repoUrl, partialAnalysisWarning) {
  return {
    repoUrl,
    language: data.language,
    framework: data.framework,
    architecture: data.architecture,
    entryPoint: data.entryPoint,
    projectType: data.projectType,
    folderTree: data.folderTree,
    folderTreeText: data.explanation?.folderTreeText,
    routes: data.routes,
    controllers: data.controllers,
    models: data.models,
    services: data.services || [],
    applicationConfig: data.applicationConfig || null,
    frontendModules: (data.monorepoResult && data.monorepoResult.frontendModules) || [],
    mlModules: (data.monorepoResult && data.monorepoResult.mlModules) || [],
    readmeSummary: data.readmeSummary || null,
    explanation: data.explanation,
    partialAnalysisWarning: partialAnalysisWarning || false
  };
}

function runAnalysis(projectPath) {
  const folderTree = fileScanner.scan(projectPath, { maxDepth: 8 });
  const language = fileScanner.detectLanguage(projectPath);
  let monorepoResult;
  try {
    monorepoResult = monorepoAnalyzer.analyze(projectPath);
  } catch (e) {
    monorepoResult = { projectType: "Unknown", isMonorepo: false, backendModules: [], frontendModules: [], mlModules: [] };
  }

  const projectType = monorepoResult.projectType || "Backend Only";
  let framework = frameworkDetector.detect(projectPath);
  let architecture = architectureDetector.detect(folderTree);
  let entryPoint = entryPointDetector.getEntryPoint(projectPath);
  let routes = routeAnalyzer.analyze(projectPath);
  let controllers = controllerAnalyzer.analyze(projectPath);
  let models = modelAnalyzer.analyze(projectPath);

  let services = [];
  let applicationConfig = null;
  if (monorepoResult.backendModules && monorepoResult.backendModules.length) {
    const first = monorepoResult.backendModules[0];
    if (first && !first.error) {
      framework = first.framework || framework;
      architecture = first.architecture || architecture;
      entryPoint = first.entryPoint || entryPoint;
      routes = first.routes || routes;
      controllers = first.controllers || controllers;
      models = first.models || models;
      services = first.services || [];
      applicationConfig = first.applicationConfig || null;
    }
  }
  if (!(monorepoResult.backendModules && monorepoResult.backendModules.length) || (monorepoResult.backendModules[0] && monorepoResult.backendModules[0].error)) {
    routes = routeAnalyzer.analyze(projectPath);
    controllers = controllerAnalyzer.analyze(projectPath);
    models = modelAnalyzer.analyze(projectPath);
  }

  const readmeSummary = readmeService.getReadmeSummary(projectPath);

  const explanation = explanationGenerator.generate({
    projectType,
    monorepoResult,
    language,
    framework,
    architecture,
    entryPoint,
    routes,
    controllers,
    models,
    services,
    readmeSummary,
    folderTree
  });

  return {
    folderTree,
    language,
    framework,
    architecture,
    entryPoint,
    routes,
    controllers,
    models,
    services,
    applicationConfig,
    readmeSummary,
    monorepoResult,
    projectType,
    explanation
  };
}

function buildPartialResult(projectPath, repoLabel) {
  const folderTree = fileScanner.scan(projectPath, { maxDepth: 5 });
  const typeResult = projectTypeDetector.detect(projectPath);
  const explanation = explanationGenerator.generate({
    projectType: typeResult.projectType || "Unknown",
    monorepoResult: { backendModules: [], frontendModules: [], mlModules: [], isMonorepo: false },
    language: fileScanner.detectLanguage(projectPath),
    framework: "—",
    architecture: "—",
    entryPoint: "—",
    routes: [],
    controllers: [],
    models: [],
    readmeSummary: null,
    folderTree
  });
  explanation.executionFlow = "Analysis timed out after 60 seconds.\n\nLarge repository — partial results generated.\n\n" + (explanation.executionFlow || "");
  explanation.summary = (explanation.summary || "") + "\n\n⚠ Large repository — partial results generated (max 60s).";
  return {
    folderTree,
    language: fileScanner.detectLanguage(projectPath),
    framework: "—",
    architecture: "—",
    entryPoint: "—",
    routes: [],
    controllers: [],
    models: [],
    readmeSummary: null,
    monorepoResult: { frontendModules: [], mlModules: [] },
    projectType: typeResult.projectType || "Unknown",
    explanation
  };
}

function renderResult(res, data, repoUrl, partialAnalysisWarning) {
  const payload = {
    repoUrl,
    language: data.language,
    framework: data.framework,
    architecture: data.architecture,
    entryPoint: data.entryPoint,
    projectType: data.projectType,
    folderTree: data.folderTree,
    folderTreeText: data.explanation.folderTreeText,
    routes: data.routes,
    controllers: data.controllers,
    models: data.models,
    frontendModules: (data.monorepoResult && data.monorepoResult.frontendModules) || [],
    mlModules: (data.monorepoResult && data.monorepoResult.mlModules) || [],
    readmeSummary: data.readmeSummary || null,
    explanation: data.explanation,
    partialAnalysisWarning: partialAnalysisWarning || false
  };
  res.render("result", payload);
}

exports.analyzeRepo = async (req, res) => {
  const repoUrl = (req.body.repoUrl || req.body.url || "").trim();
  if (!repoUrl) {
    if (wantsJson(req)) return res.status(400).json({ error: "Repository URL is required." });
    return res.status(400).render("index", { error: "Repository URL is required." });
  }

  let projectPath = null;
  try {
    projectPath = await gitService.cloneRepo(repoUrl);

    const { result, timedOut } = await analysisTimeout.runWithTimeout(
      Promise.resolve().then(() => runAnalysis(projectPath)),
      analysisTimeout.ANALYSIS_TIMEOUT_MS
    );

    if (timedOut || !result) {
      const partial = buildPartialResult(projectPath, repoUrl);
      if (wantsJson(req)) return res.json(buildJsonPayload(partial, repoUrl, true));
      renderResult(res, partial, repoUrl, true);
      return;
    }

    const reportPayload = {
      repoUrl,
      language: result.language,
      framework: result.framework,
      architecture: result.architecture,
      entryPoint: result.entryPoint,
      folderTree: result.folderTree,
      routes: result.routes,
      controllers: result.controllers,
      models: result.models,
      readmeSummary: result.readmeSummary || "",
      summary: result.explanation.summary,
      executionFlow: result.explanation.executionFlow,
      projectType: result.projectType
    };
    if (result.monorepoResult.frontendModules && result.monorepoResult.frontendModules.length) {
      reportPayload.frontend = result.monorepoResult.frontendModules;
    }
    if (result.monorepoResult.mlModules && result.monorepoResult.mlModules.length) {
      reportPayload.ml = result.monorepoResult.mlModules;
    }
    if (result.monorepoResult.isMonorepo) {
      reportPayload.modules = {
        frontendRoots: result.monorepoResult.frontendRoots,
        backendRoots: result.monorepoResult.backendRoots,
        mlRoots: result.monorepoResult.mlRoots
      };
    }

    await AnalysisReport.create(reportPayload).then((report) => Repository.create({ repoUrl, reportId: report._id }));

    if (wantsJson(req)) return res.json(buildJsonPayload(result, repoUrl, false));
    renderResult(res, result, repoUrl, false);
  } catch (err) {
    console.error("Analyze error:", err);
    const msg = err.message || "Failed to analyze repository. Check URL and try again.";
    if (wantsJson(req)) return res.status(500).json({ error: msg });
    res.status(500).render("index", { error: msg });
  } finally {
    if (projectPath) await gitService.cleanTemp(projectPath);
  }
};

exports.analyzeZip = async (req, res) => {
  const zipService = require("../services/zipService");
  if (!req.file || !req.file.path) {
    if (wantsJson(req)) return res.status(400).json({ error: "ZIP file is required." });
    return res.status(400).render("index", { error: "ZIP file is required." });
  }
  const zipPath = req.file.path;
  let extractPath = null;
  let tempRoot = null;

  try {
    const extracted = await zipService.extractZip(zipPath);
    extractPath = extracted.extractPath;
    tempRoot = extracted.tempRoot;

    const { result, timedOut } = await analysisTimeout.runWithTimeout(
      Promise.resolve().then(() => runAnalysis(extractPath)),
      analysisTimeout.ANALYSIS_TIMEOUT_MS
    );

    const repoLabel = req.file.originalname ? req.file.originalname.replace(/\.zip$/i, "") : "ZIP upload";

    if (timedOut || !result) {
      const partial = buildPartialResult(extractPath, repoLabel);
      if (wantsJson(req)) return res.json(buildJsonPayload(partial, repoLabel, true));
      renderResult(res, partial, repoLabel, true);
      return;
    }

    const reportPayload = {
      repoUrl: repoLabel,
      language: result.language,
      framework: result.framework,
      architecture: result.architecture,
      entryPoint: result.entryPoint,
      folderTree: result.folderTree,
      routes: result.routes,
      controllers: result.controllers,
      models: result.models,
      readmeSummary: result.readmeSummary || "",
      summary: result.explanation.summary,
      executionFlow: result.explanation.executionFlow,
      projectType: result.projectType
    };
    if (result.monorepoResult.frontendModules && result.monorepoResult.frontendModules.length) {
      reportPayload.frontend = result.monorepoResult.frontendModules;
    }
    if (result.monorepoResult.mlModules && result.monorepoResult.mlModules.length) {
      reportPayload.ml = result.monorepoResult.mlModules;
    }
    if (result.monorepoResult.isMonorepo) {
      reportPayload.modules = {
        frontendRoots: result.monorepoResult.frontendRoots,
        backendRoots: result.monorepoResult.backendRoots,
        mlRoots: result.monorepoResult.mlRoots
      };
    }

    await AnalysisReport.create(reportPayload).then((report) => Repository.create({ repoUrl: repoLabel, reportId: report._id }));

    if (wantsJson(req)) return res.json(buildJsonPayload(result, repoLabel, false));
    renderResult(res, result, repoLabel, false);
  } catch (err) {
    console.error("Analyze ZIP error:", err);
    const msg = err.message || "Failed to analyze ZIP file.";
    if (wantsJson(req)) return res.status(500).json({ error: msg });
    res.status(500).render("index", { error: msg });
  } finally {
    try {
      const fs = require("fs-extra");
      if (zipPath && fs.existsSync(zipPath)) fs.unlink(zipPath).catch(() => {});
    } catch (e) {}
    if (tempRoot) await zipService.cleanZipExtract(tempRoot);
  }
};
