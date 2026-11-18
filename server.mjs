import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};
const port = Number(process.env.PORT || 4173);
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let target = path.resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!target.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      if ((await stat(target)).isDirectory())
        target = path.join(target, "index.html");
      const bytes = await readFile(target);
      res.writeHead(200, {
        "Content-Type":
          (types[path.extname(target)] || "application/octet-stream") +
          ([".html", ".css", ".js"].includes(path.extname(target))
            ? "; charset=utf-8"
            : ""),
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`CareSlot is ready at http://localhost:${port}`),
  );
