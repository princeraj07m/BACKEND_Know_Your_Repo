const gitService = require("../services/gitService");
const fileScanner = require("../services/fileScannerService");
const frameworkDetector = require("../services/frameworkDetector");
const architectureDetector = require("../services/architectureDetector");
const routeAnalyzer = require("../services/routeAnalyzer");
const controllerAnalyzer = require("../services/controllerAnalyzer");
const modelAnalyzer = require("../services/modelAnalyzer");
const explanationGenerator = require("../services/explanationGenerator");

const AnalysisReport = require("../models/AnalysisReport");

exports.analyzeRepo = async (req, res) => {
  const { repoUrl } = req.body;

  try {
    const projectPath = await gitService.cloneRepo(repoUrl);

    const fileTree = fileScanner.scan(projectPath);
    const language = fileScanner.detectLanguage(projectPath);
    const framework = frameworkDetector.detect(projectPath);
    const architecture = architectureDetector.detect(fileTree);

    const routes = routeAnalyzer.analyze(projectPath);
    const controllers = controllerAnalyzer.analyze(projectPath);
    const models = modelAnalyzer.analyze(projectPath);

    const explanation = explanationGenerator.generate({
      language,
      framework,
      architecture,
      routes,
      controllers,
      models
    });

    await AnalysisReport.create({
      repoUrl,
      language,
      framework,
      architecture,
      routes,
      controllers,
      models,
      summary: explanation.summary,
      executionFlow: explanation.executionFlow
    });

    res.render("result", { explanation, routes, controllers, models });

  } catch (err) {
    console.log(err);
    res.send("❌ Error analyzing repository.");
  }
};