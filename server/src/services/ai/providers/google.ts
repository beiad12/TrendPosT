import type { AiAdapter, CaptionRequest, CaptionResult } from "../types.js";
import { buildSystemPrompt, buildUserPrompt, extractJson } from "../promptBuilder.js";
import { DEFAULT_MODELS } from "../providers.js";

export const googleAdapter: AiAdapter = {
  provider: "google",
  async generateCaptions(apiKey: string, req: CaptionRequest): Promise<CaptionResult> {
    const model = DEFAULT_MODELS.google;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
        contents: [{ role: "user", parts: [{ text: buildUserPrompt(req) }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (!res.ok) {
      throw new Error(`Google Gemini API error ${res.status}: ${await res.text()}`);
    }

    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = extractJson(text);

    return {
      provider: "google",
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
