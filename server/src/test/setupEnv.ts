// Runs before any test file's module graph loads (vitest `setupFiles`) so
// db/index.ts picks up an in-memory database instead of touching the real
// dev-data sqlite file on disk.
process.env.SQLITE_PATH = ":memory:";
