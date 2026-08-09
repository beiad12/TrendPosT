import { db } from "../../db/index.js";
import { decryptSecret } from "../crypto.js";
import type { AiAdapter, CaptionRequest, CaptionResult } from "./types.js";
import { ProviderKeyMissingError } from "./types.js";
import type { Provider } from "./providers.js";
import { anthropicAdapter } from "./providers/anthropic.js";
import { openaiAdapter } from "./providers/openai.js";
import { mistralAdapter } from "./providers/mistral.js";
import { googleAdapter } from "./providers/google.js";
import { xaiAdapter } from "./providers/xai.js";

const ADAPTERS: Record<Provider, AiAdapter> = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  mistral: mistralAdapter,
  google: googleAdapter,
  xai: xaiAdapter,
};

function getApiKey(provider: Provider): string | null {
  const row = db
    .prepare<
      [string],
      { ciphertext: string; iv: string; auth_tag: string }
    >("SELECT ciphertext, iv, auth_tag FROM api_keys WHERE provider = ?")
    .get(provider);
  if (!row) return null;
  return decryptSecret({
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.auth_tag,
  });
}

/** Unified AI-router: {trend, tone, language, provider} -> normalized captions. */
export async function generateCaptions(
  req: CaptionRequest
): Promise<CaptionResult> {
  const apiKey = getApiKey(req.provider);
  if (!apiKey) throw new ProviderKeyMissingError(req.provider);

  const adapter = ADAPTERS[req.provider];
  return adapter.generateCaptions(apiKey, req);
}

export function configuredProviders(): Provider[] {
  const rows = db
    .prepare<[], { provider: Provider }>("SELECT provider FROM api_keys")
    .all();
  return rows.map((r) => r.provider);
}
