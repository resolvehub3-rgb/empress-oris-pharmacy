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
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Empress Oris Herbal & Mart POS & Inventory Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
