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
    const framework = frameworkDetector.detect(projectPath);
    const architecture = architectureDetector.detect(folderTree);
    const entryPoint = entryPointDetector.getEntryPoint(projectPath);
    const routes = routeAnalyzer.analyze(projectPath);
    const controllers = controllerAnalyzer.analyze(projectPath);
    const models = modelAnalyzer.analyze(projectPath);
    const readmeSummary = readmeService.getReadmeSummary(projectPath);

    const explanation = explanationGenerator.generate({
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

    const report = await AnalysisReport.create({
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
      executionFlow: explanation.executionFlow
    });

    await Repository.create({ repoUrl, reportId: report._id });

    res.render("result", {
      repoUrl,
      language,
      framework,
      architecture,
      entryPoint,
      folderTree,
      folderTreeText: explanation.folderTreeText,
      routes,
      controllers,
      models,
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
