const express = require("express");
const path = require("path");
const connectDB = require("./config/db");
const analyzeRoutes = require("./routes/analyzeRoutes");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

connectDB().then(() => {
  app.use("/", analyzeRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render("index", { error: err.message || "Something went wrong." });
  });

  const PORT = parseInt(process.env.PORT, 10) || 3000;

  function tryListen(port) {
    const server = app.listen(port, () => {
      console.log("DevInsight running on http://localhost:" + port);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.warn("Port " + port + " is in use, trying " + (port + 1) + "...");
        tryListen(port + 1);
      } else {
        console.error(err);
        process.exit(1);
      }
    });
  }

  tryListen(PORT);
}).catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
