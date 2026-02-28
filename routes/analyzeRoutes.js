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
router.post("/analyze-zip", function (req, res, next) {
  uploadZip.single("zipfile")(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).render("index", { error: err.code === "LIMIT_FILE_SIZE" ? "ZIP file exceeds maximum size (100MB)." : "Invalid file upload." });
    }
    if (err) return res.status(400).render("index", { error: err.message || "Invalid file." });
    next();
  });
}, analyzeController.analyzeZip);

module.exports = router;