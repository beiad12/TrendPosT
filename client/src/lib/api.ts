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

export type ZoneAlign = "left" | "center" | "right";
export type FontWeight = "regular" | "bold" | "extrabold";

interface ZoneBase extends Rect {
  id: string;
  label: string;
  /** Locked zones always render defaultValue and aren't shown as editable inputs. */
  locked?: boolean;
}

export interface TextZoneDef extends ZoneBase {
  type: "text";
  align?: ZoneAlign;
  weight?: FontWeight;
  color?: string;
  highlightColor?: string;
  maxLines?: number;
  defaultValue?: string;
  prefix?: string;
  pill?: boolean;
  pillColor?: string;
}

export interface PhotoZoneDef extends ZoneBase {
  type: "photo";
}

export type ZoneDef = TextZoneDef | PhotoZoneDef;

export function isTextZone(z: ZoneDef): z is TextZoneDef {
  return z.type === "text";
}

export function isPhotoZone(z: ZoneDef): z is PhotoZoneDef {
  return z.type === "photo";
}

export interface TemplateStyle {
  canvasBackground?: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  /** Locked, pixel-perfect background artwork — every zone composites on top of it. */
  baseImagePath: string;
  canvasWidth: number;
  canvasHeight: number;
  /** Reusable layer system: any number of text/photo zones, in paint order. */
  zones: ZoneDef[];
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
