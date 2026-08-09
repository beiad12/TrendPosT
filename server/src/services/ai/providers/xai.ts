import type { AiAdapter, CaptionRequest, CaptionResult } from "../types.js";
import { buildSystemPrompt, buildUserPrompt, extractJson } from "../promptBuilder.js";
import { DEFAULT_MODELS } from "../providers.js";

// xAI's Grok API is OpenAI-compatible.
export const xaiAdapter: AiAdapter = {
  provider: "xai",
  async generateCaptions(apiKey: string, req: CaptionRequest): Promise<CaptionResult> {
    const model = DEFAULT_MODELS.xai;
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(req) },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`xAI Grok API error ${res.status}: ${await res.text()}`);
    }

    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(text);

    return {
      provider: "xai",
      model,
      variants: parsed.variants.map((v: any) => ({
        tone: v.tone,
        language: req.language,
        caption: v.caption,
        hashtags: v.hashtags ?? [],
      })),
      suggestedPostTime: parsed.suggestedPostTime,
      raw: data,
    };
  },
};
