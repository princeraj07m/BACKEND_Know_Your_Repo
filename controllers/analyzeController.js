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
const AnalysisReport = require("../models/AnalysisReport");
const Repository = require("../models/Repository");

exports.analyzeRepo = async (req, res, next) => {
  const repoUrl = (req.body.repoUrl || "").trim();
  if (!repoUrl) {
    return res.status(400).render("index", { error: "Repository URL is required." });
  }

  let projectPath = null;
  try {
    projectPath = await gitService.cloneRepo(repoUrl);

    const folderTree = fileScanner.scan(projectPath);
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

    if (monorepoResult.backendModules && monorepoResult.backendModules.length) {
      const first = monorepoResult.backendModules[0];
      if (first && !first.error) {
        framework = first.framework || framework;
        architecture = first.architecture || architecture;
        entryPoint = first.entryPoint || entryPoint;
        routes = first.routes || routes;
        controllers = first.controllers || controllers;
        models = first.models || models;
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
      readmeSummary,
      folderTree
    });

    const reportPayload = {
      repoUrl,
      language,
      framework,
      architecture,
      entryPoint,
      folderTree,
      routes,
      controllers,
      models,
      readmeSummary: readmeSummary || "",
      summary: explanation.summary,
      executionFlow: explanation.executionFlow,
      projectType
    };
    if (monorepoResult.frontendModules && monorepoResult.frontendModules.length) {
      reportPayload.frontend = monorepoResult.frontendModules;
    }
    if (monorepoResult.mlModules && monorepoResult.mlModules.length) {
      reportPayload.ml = monorepoResult.mlModules;
    }
    if (monorepoResult.isMonorepo) {
      reportPayload.modules = {
        frontendRoots: monorepoResult.frontendRoots,
        backendRoots: monorepoResult.backendRoots,
        mlRoots: monorepoResult.mlRoots
      };
    }

    const report = await AnalysisReport.create(reportPayload);

    await Repository.create({ repoUrl, reportId: report._id });

    res.render("result", {
      repoUrl,
      language,
      framework,
      architecture,
      entryPoint,
      projectType,
      folderTree,
      folderTreeText: explanation.folderTreeText,
      routes,
      controllers,
      models,
      frontendModules: monorepoResult.frontendModules || [],
      mlModules: monorepoResult.mlModules || [],
      readmeSummary: readmeSummary || null,
      explanation
    });
  } catch (err) {
    console.error("Analyze error:", err);
    res.status(500).render("index", { error: err.message || "Failed to analyze repository. Check URL and try again." });
  } finally {
    if (projectPath) await gitService.cleanTemp(projectPath);
  }
};
