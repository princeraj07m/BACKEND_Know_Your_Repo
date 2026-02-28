exports.detect = (fileTree) => {
  if (fileTree.includes("controllers") && fileTree.includes("models"))
    return "MVC Architecture";

  return "Basic Structure";
};