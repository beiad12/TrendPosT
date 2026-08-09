import { Router } from "express";
import { db } from "../db/index.js";
import { encryptSecret } from "../services/crypto.js";
import { PROVIDERS } from "../services/ai/providers.js";

export const settingsRouter = Router();

/**
 * GET /api/settings/keys
 * Returns which providers have a key configured, WITHOUT ever returning
 * the key material itself.
 */
settingsRouter.get("/keys", (_req, res) => {
  const rows = db
    .prepare("SELECT provider, updated_at FROM api_keys")
    .all() as { provider: string; updated_at: string }[];
  const configured = new Map(rows.map((r) => [r.provider, r.updated_at]));

  const status = PROVIDERS.map((p) => ({
    provider: p,
    configured: configured.has(p),
    updatedAt: configured.get(p) ?? null,
  }));

  res.json({ providers: status });
});

/**
 * PUT /api/settings/keys/:provider
 * Body: { apiKey: string }
 * Encrypts and stores (or replaces) the key for a provider.
 */
settingsRouter.put("/keys/:provider", (req, res) => {
  const { provider } = req.params;
  if (!PROVIDERS.includes(provider as any)) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }
  const { apiKey } = req.body ?? {};
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 8) {
    return res.status(400).json({ error: "apiKey is required (min 8 chars)" });
  }

  const { ciphertext, iv, authTag } = encryptSecret(apiKey.trim());
  db.prepare(
    `INSERT INTO api_keys (provider, ciphertext, iv, auth_tag, updated_at)
     VALUES (@provider, @ciphertext, @iv, @authTag, datetime('now'))
     ON CONFLICT(provider) DO UPDATE SET
       ciphertext = excluded.ciphertext,
       iv = excluded.iv,
       auth_tag = excluded.auth_tag,
       updated_at = excluded.updated_at`
  ).run({ provider, ciphertext, iv, authTag });

  // Never log or echo the raw key back.
  res.json({ provider, configured: true });
});

/**
 * DELETE /api/settings/keys/:provider
 */
settingsRouter.delete("/keys/:provider", (req, res) => {
  const { provider } = req.params;
  db.prepare("DELETE FROM api_keys WHERE provider = ?").run(provider);
  res.json({ provider, configured: false });
});
