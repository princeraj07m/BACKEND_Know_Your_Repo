const path = require("path");
const fs = require("fs-extra");
const multer = require("multer");
const zipService = require("../services/zipService");

const TEMP_BASE = path.join(process.cwd(), "temp");
const UPLOAD_DIR = path.join(TEMP_BASE, "uploads");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    fs.ensureDirSync(UPLOAD_DIR);
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const safe = (file.originalname || "upload").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    cb(null, "zip_" + Date.now() + "_" + safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: zipService.MAX_ZIP_SIZE },
  fileFilter: function (req, file, cb) {
    const name = (file.originalname || "").toLowerCase();
    if (!name.endsWith(".zip")) {
      return cb(new Error("Only .zip files are allowed."));
    }
    cb(null, true);
  }
});

module.exports = upload;
