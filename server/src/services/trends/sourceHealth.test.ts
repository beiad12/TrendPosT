import { describe, it, expect, beforeEach } from "vitest";
import { getHealth, isBackedOff, recordFailure, recordNotConfigured, recordSuccess } from "./sourceHealth.js";

describe("sourceHealth", () => {
  it("reports healthy with fetched-item count after a success", () => {
    recordSuccess("test_provider_a", "Test Provider A", 12, 340);
    const health = getHealth("test_provider_a")!;
    expect(health.status).toBe("healthy");
    expect(health.itemsFetched).toBe(12);
    expect(health.latencyMs).toBe(340);
    expect(health.errorCount).toBe(0);
  });

  it("degrades after a failure and enters a backoff window", () => {
    recordFailure("test_provider_b", "Test Provider B", new Error("Status code 403"), 403);
    const health = getHealth("test_provider_b")!;
    expect(health.status).toBe("degraded");
    expect(health.errorCount).toBe(1);
    expect(health.lastError).toContain("403");
    expect(isBackedOff("test_provider_b")).toBe(true);
  });

  it("marks a provider unavailable after repeated failures", () => {
    const id = "test_provider_c";
    recordFailure(id, "Test Provider C", new Error("404"));
    recordFailure(id, "Test Provider C", new Error("404"));
    recordFailure(id, "Test Provider C", new Error("404"));
    const health = getHealth(id)!;
    expect(health.status).toBe("unavailable");
    expect(health.errorCount).toBe(3);
  });

  it("a subsequent success clears the backoff and error count", () => {
    const id = "test_provider_d";
    recordFailure(id, "Test Provider D", new Error("timeout"));
    expect(isBackedOff(id)).toBe(true);
    recordSuccess(id, "Test Provider D", 5, 100);
    expect(isBackedOff(id)).toBe(false);
    expect(getHealth(id)!.status).toBe("healthy");
    expect(getHealth(id)!.errorCount).toBe(0);
  });

  it("not_configured never counts as an error", () => {
    const id = "test_provider_e";
    recordNotConfigured(id, "Test Provider E", "Requires REDDIT_CLIENT_ID");
    const health = getHealth(id)!;
    expect(health.status).toBe("not_configured");
    expect(health.errorCount).toBe(0);
    expect(isBackedOff(id)).toBe(false);
  });

  it("returns null for a provider that's never reported anything", () => {
    expect(getHealth("never_seen_provider")).toBeNull();
  });
});
