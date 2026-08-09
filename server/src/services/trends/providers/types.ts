import type { RawArticle } from "../types.js";

export type ProviderKind = "rss" | "search" | "api" | "social";

/** Every trend source implements this — the aggregator only ever talks to this interface, never to a provider's raw HTTP details. */
export interface TrendProvider {
  id: string;
  name: string;
  type: ProviderKind;
  /** False providers (missing credentials, permanently dead endpoint) are skipped without ever being fetched or reported as an error. */
  enabled: boolean;
  /** Why `enabled` is false — shown in the health panel instead of a scary error. */
  disabledReason?: string;
  fetch(): Promise<RawArticle[]>;
}
