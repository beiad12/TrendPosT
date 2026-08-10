import type { Provider } from "./providers.js";

export type Language = "darija" | "french" | "msa" | "english";

export type Tone =
  | "funny"
  | "informative"
  | "question-hook"
  | "emotional"
  | "controversial-safe";

export interface TrendInput {
  title: string;
  summary?: string;
  sourceUrl: string;
  source: string;
  category?: string;
  /** Extra grounding context from the trend engine, when available — never fabricated if missing. */
  score?: number;
  sourceCount?: number;
  publishedAt?: string;
}

export interface CaptionRequest {
  provider: Provider;
  trend: TrendInput;
  language: Language;
  tones?: Tone[]; // defaults to all 5
}

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
  /** A short, punchy poster headline distinct from the full captions — may contain `**highlight**` markup. */
  headline?: string;
  raw?: unknown;
}

export interface AiAdapter {
  provider: Provider;
  generateCaptions(
    apiKey: string,
    req: CaptionRequest
  ): Promise<CaptionResult>;
}

export class ProviderKeyMissingError extends Error {
  constructor(public provider: Provider) {
    super(`No API key configured for provider "${provider}"`);
    this.name = "ProviderKeyMissingError";
  }
}
