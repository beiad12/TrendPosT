// Free, no-API-key AI image generation (https://pollinations.ai/) — the
// preferred AI generation fallback specifically *because* it needs zero
// setup: unlike OpenAI's DALL-E, there's no key to add in Settings before
// this works, so "AI-generate a photo" is available out of the box for
// every install. OpenAI (sources/openaiImage.ts) is tried second, as a
// higher-effort fallback for anyone who's already configured a key.
const BASE_URL = process.env.POLLINATIONS_API_BASE || "https://image.pollinations.ai/prompt";

/** Always true — no credentials required — kept for symmetry with the other (optional, key-gated) sources. */
export const pollinationsConfigured = true;

/** Free-tier image generation can be slow (tens of seconds) under load; fail rather than hang indefinitely. */
const TIMEOUT_MS = 60_000;

export async function generatePollinationsImage(prompt: string): Promise<Buffer> {
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `${BASE_URL}/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;

  const resp = await fetch(url, {
    headers: { "User-Agent": "TrendPostBot/1.0 (+https://github.com/beiad12/trendpost)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`Pollinations image generation failed (${resp.status})`);

  const buffer = Buffer.from(await resp.arrayBuffer());
  // A real generated JPEG/PNG is always well over a few KB; a suspiciously
  // tiny response is more likely an HTML error page than a usable photo.
  if (buffer.length < 1000) {
    throw new Error("Pollinations returned a suspiciously small response (likely an error, not an image)");
  }
  return buffer;
}
