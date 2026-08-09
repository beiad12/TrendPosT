import type { AiAdapter, CaptionRequest, CaptionResult } from "./types.js";
import { ProviderKeyMissingError } from "./types.js";
import type { Provider } from "./providers.js";
import { getProviderApiKey } from "./keyVault.js";
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

/** Unified AI-router: {trend, tone, language, provider} -> normalized captions. */
export async function generateCaptions(
  req: CaptionRequest
): Promise<CaptionResult> {
  const apiKey = getProviderApiKey(req.provider);
  if (!apiKey) throw new ProviderKeyMissingError(req.provider);

  const adapter = ADAPTERS[req.provider];
  return adapter.generateCaptions(apiKey, req);
}
