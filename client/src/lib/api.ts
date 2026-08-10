export type TrendType = "BREAKING" | "RISING" | "VIRAL" | "POPULAR" | "STABLE";

export interface ScoreBreakdown {
  freshness: number;
  sourceCount: number;
  velocity: number;
  moroccoRelevance: number;
  social: number;
  category: number;
  viralPotential: number;
  total: number;
}

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
  summary: string | null;
  sourceCount: number;
  sources: string[];
  trendType: TrendType;
  categoryEmoji: string;
  ageMinutes: number;
  velocityPerHour: number;
  scoreBreakdown: ScoreBreakdown;
  articleCount: number;
}

export type ProviderHealthStatus = "healthy" | "degraded" | "unavailable" | "not_configured";

export interface ProviderHealth {
  id: string;
  name: string;
  status: ProviderHealthStatus;
  lastSuccess: string | null;
  lastFailure: string | null;
  lastAttempt: string | null;
  errorCount: number;
  latencyMs: number | null;
  itemsFetched: number;
  lastError: string | null;
  nextRetryAt: string | null;
}

export interface TrendsResponse {
  trends: Trend[];
  generatedAt: string;
  sources: string[];
  sourceHealth: ProviderHealth[];
  country?: string;
  warning?: "no_live_data" | "showing_cached" | "refresh_failed_showing_cached";
}

export interface CountryOption {
  code: string;
  name: string;
  mapName: string;
  language: string;
}

export interface CategoryOption {
  key: string;
  label: string;
  labelEn: string;
  emoji: string;
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

export interface AutoPostResult {
  headline: string;
  caption: string;
  hashtags: string[];
  suggestedPostTime?: string;
  imageBase64: string;
  format: "jpeg" | "png";
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

export type BrandingPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface Branding {
  logoUrl: string | null;
  position: BrandingPosition;
  updatedAt: string | null;
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

/**
 * Server error responses aren't perfectly uniform (plain string `error`,
 * `{error, message}`, `{error, detail}`, or a zod `.flatten()` shape under
 * `error`) — this pulls out whichever field actually has the human-readable
 * text instead of falling back to a generic label or "[object Object]".
 */
function extractErrorMessage(body: any, status: number): string {
  if (typeof body?.message === "string") return body.message;
  if (typeof body?.detail === "string") return body.detail;
  if (typeof body?.error === "string") return body.error;
  if (typeof body?.error?.message === "string") return body.error.message;
  const firstFieldError = Object.values(body?.error?.fieldErrors ?? {}).flat()[0];
  if (typeof firstFieldError === "string") return firstFieldError;
  return `Request failed: ${status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(body, res.status));
  }
  return res.json();
}

export const api = {
  trends: {
    list: (
      params: { refresh?: boolean; category?: string; language?: string; status?: string; limit?: number; country?: string } = {}
    ) => {
      const qs = new URLSearchParams();
      if (params.refresh) qs.set("refresh", "1");
      if (params.category) qs.set("category", params.category);
      if (params.language) qs.set("language", params.language);
      if (params.status) qs.set("status", params.status);
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.country) qs.set("country", params.country);
      const query = qs.toString();
      return request<TrendsResponse>(`/trends${query ? `?${query}` : ""}`);
    },
    detail: (id: string, country?: string) =>
      request<{ trend: Trend; articles: unknown[]; sources: string[]; scoreBreakdown: ScoreBreakdown }>(
        `/trends/${id}${country ? `?country=${country}` : ""}`
      ),
    refresh: (country?: string) =>
      request<TrendsResponse>(`/trends/refresh${country ? `?country=${country}` : ""}`, { method: "POST" }),
    countries: () => request<{ countries: CountryOption[] }>("/trends/countries"),
    categories: () => request<{ categories: CategoryOption[] }>("/trends/categories"),
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
      trend: {
        title: string;
        summary?: string;
        sourceUrl: string;
        source: string;
        category?: string;
        score?: number;
        sourceCount?: number;
        publishedAt?: string;
      };
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
    detectZones: (file: File) => {
      const form = new FormData();
      form.set("file", file);
      return request<{ zones: ZoneDef[] }>("/templates/detect-zones", { method: "POST", body: form });
    },
    remove: (id: string) => request<{ deleted: boolean; id: string }>(`/templates/${id}`, { method: "DELETE" }),
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
  branding: {
    get: () => request<Branding>("/branding/logo"),
    upload: (file: File, position: BrandingPosition) => {
      const form = new FormData();
      form.set("file", file);
      form.set("position", position);
      return request<Branding>("/branding/logo", { method: "POST", body: form });
    },
    setPosition: (position: BrandingPosition) =>
      request<Branding>("/branding/logo", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ position }),
      }),
    remove: () => request<Branding>("/branding/logo", { method: "DELETE" }),
  },
  autoPost: {
    generate: (body: {
      trend: {
        title: string;
        summary?: string;
        sourceUrl: string;
        source: string;
        category?: string;
        imageUrl: string;
        score?: number;
        sourceCount?: number;
        publishedAt?: string;
      };
      provider: Provider;
      language: Language;
      templateId?: string;
    }) =>
      request<AutoPostResult>("/auto-post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
  },
};
