import { generatePollinationsImage } from "./sources/pollinations.js";
import { generateOpenAiImage, openaiImageConfigured } from "./sources/openaiImage.js";

/**
 * AI-generated imagery — the last resort in the photo pipeline, only
 * reached once the trend's own source had no photo *and* the web image
 * search fallback found nothing. Tries Pollinations first (free, no API
 * key needed — works out of the box on every install), then OpenAI's
 * DALL-E if a key is configured in Settings. Throws only once every
 * option has genuinely failed, with each source's own error included.
 */
export async function generateAiImage(prompt: string): Promise<Buffer> {
  const errors: string[] = [];

  try {
    return await generatePollinationsImage(prompt);
  } catch (err) {
    errors.push(`Pollinations: ${(err as Error)?.message}`);
  }

  if (openaiImageConfigured()) {
    try {
      return await generateOpenAiImage(prompt);
    } catch (err) {
      errors.push(`OpenAI: ${(err as Error)?.message}`);
    }
  }

  throw new Error(`AI image generation failed (${errors.join("; ")})`);
}
