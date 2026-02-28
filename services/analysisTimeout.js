const ANALYSIS_TIMEOUT_MS = 60 * 1000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

exports.runWithTimeout = function runWithTimeout(promise, ms) {
  ms = ms || ANALYSIS_TIMEOUT_MS;
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("TIMEOUT")), ms);
  });
  return Promise.race([promise, timeoutPromise])
    .then((result) => {
      clearTimeout(timeoutId);
      return { result, timedOut: false };
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      if (err && err.message === "TIMEOUT") return { result: null, timedOut: true };
      throw err;
    });
};

exports.ANALYSIS_TIMEOUT_MS = ANALYSIS_TIMEOUT_MS;
