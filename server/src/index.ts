import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { trendsRouter } from "./routes/trends.js";
import { aiRouter } from "./routes/ai.js";
import { settingsRouter } from "./routes/settings.js";
import { templatesRouter } from "./routes/templates.js";
import { renderRouter } from "./routes/render.js";
import { autoPostRouter } from "./routes/autoPost.js";
import { brandingRouter } from "./routes/branding.js";
import { TEMPLATES_DIR, EXPORTS_DIR, UPLOADS_DIR, BRANDING_DIR } from "./middleware/upload.js";
import { seedMarocViralTemplates, seedPressPosterTemplate, seedDramaticStoryTemplates } from "./services/seedTemplates.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

// Static access to stored template frames, uploads, and rendered exports.
app.use("/static/templates", express.static(TEMPLATES_DIR));
app.use("/static/uploads", express.static(UPLOADS_DIR));
app.use("/static/exports", express.static(EXPORTS_DIR));
app.use("/static/branding", express.static(BRANDING_DIR));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/trends", trendsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/render", renderRouter);
app.use("/api/auto-post", autoPostRouter);
app.use("/api/branding", brandingRouter);

// Generic error handler (e.g. multer file-filter/size-limit rejections, or any
// route handler's rejected promise via asyncHandler).
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err?.status ?? (err instanceof multer.MulterError ? 400 : 500);
  res.status(status).json({ error: err?.message ?? "Internal server error" });
});

// Last-resort safety net: log and keep the process alive rather than crashing
// on any error path that somehow still escapes asyncHandler/route-level try/catch.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

Promise.all([seedMarocViralTemplates(), seedPressPosterTemplate(), seedDramaticStoryTemplates()])
  .catch((err) => console.error("Failed to seed default templates:", err))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`TrendPost API listening on http://localhost:${PORT}`);
    });
  });
