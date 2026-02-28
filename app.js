const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const analyzeRoutes = require("./routes/analyzeRoutes");

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// DB Connection
require("./config/db");

// Routes
app.use("/", analyzeRoutes);

app.listen(3000, () => {
  console.log("🚀 DevInsight running on http://localhost:3000");
});