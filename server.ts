import "dotenv/config";
import path from "path";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createExpressApp } from "./src/server/app";
import { runSchemaInit } from "./src/db/init";
import { ensureStorageBuckets } from "./src/services/supabase";

async function startServer() {
  const app = createExpressApp();
  const PORT = 3000;

  // Initialize DB schema & Supabase buckets in background if configured
  runSchemaInit()
    .then(() => ensureStorageBuckets())
    .catch((err) => console.log("[Startup] Initial connection note:", err?.message || err));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith(".html") ||
            filePath.endsWith("sw.js") ||
            filePath.endsWith(".webmanifest")
          ) {
            // Service worker + entry document must always revalidate.
            res.setHeader("Cache-Control", "no-cache");
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            // Vite fingerprints these filenames, so they can be cached hard.
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else {
            res.setHeader("Cache-Control", "public, max-age=3600");
          }
        },
      })
    );
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "localhost", () => {
    console.log(`Empress Oris Herbal & Mart POS & Inventory Server running on http://localhost:${PORT}`);
  });
}

startServer();
