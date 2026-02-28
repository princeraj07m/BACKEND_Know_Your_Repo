const express = require("express");
const router = express.Router();
const multer = require("multer");
const analyzeController = require("../controllers/analyzeController");
const uploadZip = require("../middleware/uploadZip");

router.get("/", (req, res) => {
  res.render("index");
});

router.post("/analyze", analyzeController.analyzeRepo);
router.post("/analyze/json", (req, res, next) => {
  req._forceJson = true;
  analyzeController.analyzeRepo(req, res, next);
});
function handleZipUpload(req, res, next) {
  uploadZip.single("zipfile")(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "ZIP file exceeds maximum size (100MB)." : "Invalid file upload.";
      if (req._forceJson) return res.status(400).json({ error: msg });
      return res.status(400).render("index", { error: msg });
    }
    if (err) {
      if (req._forceJson) return res.status(400).json({ error: err.message || "Invalid file." });
      return res.status(400).render("index", { error: err.message || "Invalid file." });
    }
    next();
  });
}

router.post("/analyze-zip", handleZipUpload, analyzeController.analyzeZip);
router.post("/analyze-zip/json", (req, res, next) => {
  req._forceJson = true;
  next();
}, handleZipUpload, analyzeController.analyzeZip);

module.exports = router;