const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve("dist");
const port = Number(process.env.PORT || 8080);
const host = "127.0.0.1";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

if (!fs.existsSync(root)) {
  console.error("dist/ not found. Run `npm run build` first.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);

  // Dist mode has no backend proxy. Return a clear error for API calls.
  if (requestPath.startsWith("/api/")) {
    res.statusCode = 503;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        message:
          "API is not available in dist test mode. Start the full app with start-full.bat for Ninox login.",
      })
    );
    return;
  }

  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  let filePath = path.join(root, relativePath);

  if (!filePath.startsWith(root)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(root, "index.html");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.setHeader("content-type", mime[ext] || "application/octet-stream");
    res.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Static site running on http://127.0.0.1:${port}`);
});
