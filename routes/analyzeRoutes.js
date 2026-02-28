const express = require("express");
const router = express.Router();
const analyzeController = require("../controllers/analyzeController");

router.get("/", (req, res) => {
  res.render("index");
});

router.post("/analyze", analyzeController.analyzeRepo);

module.exports = router;