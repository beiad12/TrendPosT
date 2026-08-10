import { getProviderApiKey } from "../ai/keyVault.js";

export const aiImageGenConfigured = (): boolean => getProviderApiKey("openai") !== null;

// Overridable via env for local testing against a fixture server.
const IMAGES_API_URL = process.env.OPENAI_IMAGES_API_BASE || "https://api.openai.com/v1/images/generations";

/**
 * Real image generation via OpenAI's Images API (DALL-E 3) — the last
 * resort in the photo pipeline, only reached once the trend's own source
 * had no photo *and* the web image search fallback found nothing. Reuses
 * whatever OpenAI key is already configured in Settings for captions;
 * independent of which provider the user picked for caption generation,
 * since DALL-E is OpenAI-specific regardless.
 *
 * Returns null (not a thrown error) when no OpenAI key is configured —
 * that's a routine "this fallback isn't available" outcome for the caller
 * to skip past, not a failure worth surfacing as an error.
 */
export async function generateAiImage(prompt: string): Promise<Buffer | null> {
  const apiKey = getProviderApiKey("openai");
  if (!apiKey) return null;

  const res = await fetch(IMAGES_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json",
      n: 1,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI image generation failed (${res.status}): ${await res.text()}`);
  }

  const data: any = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || !b64) {
    throw new Error("OpenAI image generation returned no image data");
  }
  return Buffer.from(b64, "base64");
}
