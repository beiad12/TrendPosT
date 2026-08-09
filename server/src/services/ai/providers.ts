export const PROVIDERS = [
  "anthropic",
  "openai",
  "mistral",
  "google",
  "xai",
] as const;

export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "GPT (OpenAI)",
  mistral: "Mistral",
  google: "Gemini (Google)",
  xai: "Grok (xAI)",
};

export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5",
  mistral: "mistral-large-latest",
  google: "gemini-2.5-pro",
  xai: "grok-4",
};
