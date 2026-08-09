export interface Trend {
  id: string;
  source: string;
  title: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
  language: string;
  category: string;
  score: number;
  scoreExplanation: string;
}

export type Provider = "anthropic" | "openai" | "mistral" | "google" | "xai";

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "GPT (OpenAI)",
  mistral: "Mistral",
  google: "Gemini (Google)",
  xai: "Grok (xAI)",
};

export interface ProviderStatus {
  provider: Provider;
  configured: boolean;
  updatedAt: string | null;
}

export type Language = "darija" | "french" | "msa";
export type Tone = "funny" | "informative" | "question-hook" | "emotional" | "controversial-safe";

export interface CaptionVariant {
  tone: Tone;
  language: Language;
  caption: string;
  hashtags: string[];
}

export interface CaptionResult {
  provider: Provider;
  model: string;
  variants: CaptionVariant[];
  suggestedPostTime?: string;
}

export interface GenerateResultEntry {
  provider: Provider;
  ok: boolean;
  result?: CaptionResult;
  error?: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextZone extends Rect {
  align?: "left" | "center" | "right";
}

export interface TemplateStyle {
  fontFamily?: string;
  fontColor?: string;
  fontWeight?: number;
  gradientDirection?: "to-top" | "to-bottom" | "to-left" | "to-right";
  gradientOpacity?: number;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  baseImagePath: string;
  canvasWidth: number;
  canvasHeight: number;
  imageSlot: Rect;
  textZone: TextZone;
  style: TemplateStyle;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || body?.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  trends: {
    list: (refresh = false) =>
      request<{ fetchedAt: string; trends: Trend[] }>(`/trends${refresh ? "?refresh=1" : ""}`),
  },
  settings: {
    listKeys: () => request<{ providers: ProviderStatus[] }>("/settings/keys"),
    setKey: (provider: Provider, apiKey: string) =>
      request<{ provider: Provider; configured: boolean }>(`/settings/keys/${provider}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey }),
      }),
    deleteKey: (provider: Provider) =>
      request<{ provider: Provider; configured: boolean }>(`/settings/keys/${provider}`, {
        method: "DELETE",
      }),
  },
  ai: {
    generate: (body: {
      provider?: Provider;
      trend: { title: string; summary?: string; sourceUrl: string; source: string; category?: string };
      language: Language;
      tones?: Tone[];
    }) =>
      request<{ results: GenerateResultEntry[] }>("/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
  },
  templates: {
    list: () => request<{ templates: Template[] }>("/templates"),
    create: (form: FormData) =>
      request<{ template: Template }>("/templates", { method: "POST", body: form }),
  },
  render: {
    render: async (form: FormData): Promise<Blob> => {
      const res = await fetch("/api/render", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Render failed: ${res.status}`);
      }
      return res.blob();
    },
  },
};
