const simpleGit = require("simple-git");
const fs = require("fs-extra");

const git = simpleGit();

exports.cloneRepo = async (repoUrl) => {
  const tempPath = "./temp/project";

  await fs.remove(tempPath);
  await git.clone(repoUrl, tempPath);

  return tempPath;
};