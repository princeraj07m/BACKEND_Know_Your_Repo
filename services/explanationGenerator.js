exports.generate = (data) => {
  return {
    summary: `
Project built using ${data.language}.
Framework: ${data.framework}.
Architecture: ${data.architecture}.
`,

    executionFlow: `
1️⃣ App starts from entry point.
2️⃣ Routes receive client requests.
3️⃣ Controllers process logic.
4️⃣ Models interact with database.
5️⃣ Response sent back to client.
`
  };
};