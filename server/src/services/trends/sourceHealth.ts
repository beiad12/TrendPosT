import { BACKOFF_SCHEDULE_MS } from "./config.js";
import type { ProviderHealth, ProviderStatusValue } from "./types.js";

interface HealthEntry {
  name: string;
  status: ProviderStatusValue;
  lastSuccess: number | null;
  lastFailure: number | null;
  lastAttempt: number | null;
  errorCount: number;
  latencyMs: number | null;
  itemsFetched: number;
  lastError: string | null;
  nextRetryAt: number | null;
}

const registry = new Map<string, HealthEntry>();

function entry(id: string, name: string): HealthEntry {
  let e = registry.get(id);
  if (!e) {
    e = {
      name,
      status: "healthy",
      lastSuccess: null,
      lastFailure: null,
      lastAttempt: null,
      errorCount: 0,
      latencyMs: null,
      itemsFetched: 0,
      lastError: null,
      nextRetryAt: null,
    };
    registry.set(id, e);
  }
  return e;
}

/** True once a provider has failed enough times that it's in its backoff window — the aggregator should skip calling it until this clears, instead of hammering a dead endpoint every request. */
export function isBackedOff(id: string): boolean {
  const e = registry.get(id);
  return !!(e?.nextRetryAt && Date.now() < e.nextRetryAt);
}

function structuredLog(entryLog: Record<string, unknown>) {
  // One-line structured record per source event -- easy to grep/parse,
  // and doesn't spam a stack trace for routine "source is down" cases.
  console.log(`[TrendEngine] ${JSON.stringify(entryLog)}`);
}

export function recordAttempt(id: string, name: string) {
  const e = entry(id, name);
  e.lastAttempt = Date.now();
}

export function recordSuccess(id: string, name: string, itemsFetched: number, latencyMs: number) {
  const e = entry(id, name);
  e.status = "healthy";
  e.lastSuccess = Date.now();
  e.errorCount = 0;
  e.nextRetryAt = null;
  e.latencyMs = latencyMs;
  e.itemsFetched = itemsFetched;
  e.lastError = null;
  structuredLog({ provider: id, status: "healthy", fetched: itemsFetched, latencyMs });
}

export function recordFailure(id: string, name: string, error: unknown, code?: number | string) {
  const e = entry(id, name);
  e.errorCount += 1;
  e.lastFailure = Date.now();
  const backoff = BACKOFF_SCHEDULE_MS[Math.min(e.errorCount - 1, BACKOFF_SCHEDULE_MS.length - 1)];
  e.nextRetryAt = Date.now() + backoff;
  e.status = e.errorCount >= 3 ? "unavailable" : "degraded";
  e.lastError = error instanceof Error ? error.message : String(error);
  structuredLog({ provider: id, status: e.status, code: code ?? null, error: e.lastError, retryInMs: backoff });
}

export function recordNotConfigured(id: string, name: string, reason?: string) {
  const e = entry(id, name);
  e.status = "not_configured";
  e.lastError = reason ?? null;
  structuredLog({ provider: id, status: "not_configured", reason: reason ?? null });
}

export function recordDisabled(id: string, name: string, reason?: string) {
  const e = entry(id, name);
  e.status = "unavailable";
  e.lastError = reason ?? "disabled";
}

function toIso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

export function getHealth(id: string): ProviderHealth | null {
  const e = registry.get(id);
  if (!e) return null;
  return {
    id,
    name: e.name,
    status: e.status,
    lastSuccess: toIso(e.lastSuccess),
    lastFailure: toIso(e.lastFailure),
    lastAttempt: toIso(e.lastAttempt),
    errorCount: e.errorCount,
    latencyMs: e.latencyMs,
    itemsFetched: e.itemsFetched,
    lastError: e.lastError,
    nextRetryAt: toIso(e.nextRetryAt),
  };
}

export function getAllHealth(): ProviderHealth[] {
  return [...registry.keys()].map((id) => getHealth(id)!).filter(Boolean);
}
