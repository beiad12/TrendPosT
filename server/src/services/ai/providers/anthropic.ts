import type { AiAdapter, CaptionRequest, CaptionResult } from "../types.js";
import { buildSystemPrompt, buildUserPrompt, extractJson } from "../promptBuilder.js";
import { DEFAULT_MODELS } from "../providers.js";

export const anthropicAdapter: AiAdapter = {
  provider: "anthropic",
  async generateCaptions(apiKey: string, req: CaptionRequest): Promise<CaptionResult> {
    const model = DEFAULT_MODELS.anthropic;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: buildUserPrompt(req) }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    }

    const data: any = await res.json();
    const text = data?.content?.[0]?.text ?? "";
    const parsed = extractJson(text);

    return {
      provider: "anthropic",
      model,
      variants: parsed.variants.map((v: any) => ({
        tone: v.tone,
        language: req.language,
        caption: v.caption,
        hashtags: v.hashtags ?? [],
      })),
      suggestedPostTime: parsed.suggestedPostTime,
      headline: typeof parsed.headline === "string" ? parsed.headline : undefined,
      raw: data,
    };
  },
};
