import "dotenv/config";
import express from "express";
import cors from "cors";
import { trendsRouter } from "./routes/trends.js";
import { aiRouter } from "./routes/ai.js";
import { settingsRouter } from "./routes/settings.js";
import { templatesRouter } from "./routes/templates.js";
import { renderRouter } from "./routes/render.js";
import { TEMPLATES_DIR, EXPORTS_DIR, UPLOADS_DIR } from "./middleware/upload.js";
import { seedMarocViralTemplates } from "./services/seedTemplates.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

// Static access to stored template frames, uploads, and rendered exports.
app.use("/static/templates", express.static(TEMPLATES_DIR));
app.use("/static/uploads", express.static(UPLOADS_DIR));
app.use("/static/exports", express.static(EXPORTS_DIR));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/trends", trendsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/render", renderRouter);

// Generic error handler (e.g. multer file-filter rejections).
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err?.status ?? 500).json({ error: err?.message ?? "Internal server error" });
});

seedMarocViralTemplates()
  .catch((err) => console.error("Failed to seed Maroc Viral templates:", err))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`TrendPost API listening on http://localhost:${PORT}`);
    });
  });
