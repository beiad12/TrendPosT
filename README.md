# TrendPost — "Maroc Viral" Engine

A web dashboard that detects trending topics from Moroccan media, scores
them for viral potential, generates ready-to-post Facebook captions via a
choice of AI providers, and renders the final post image onto your branded
template — ready to download or (eventually) auto-publish.

Full product spec: [`docs/SPEC.md`](docs/SPEC.md).

This repo implements the spec's own recommended starting point first — **the
template rendering engine** — plus a working end-to-end scaffold for every
other module (trend discovery, virality scoring, multi-AI caption
generation, encrypted API-key vault, and the dashboard UI that ties it all
together).

---

## What's implemented

| Module | Status |
|---|---|
| **Template & image rendering engine** | ✅ Full pipeline: photo cover-fit into a drag-defined slot, gradient overlay, auto-fit/auto-wrap headline text (Arabic + Latin aware), frame composited on top, flattened export at Facebook feed size. |
| **Template editor UI** | ✅ Upload a frame image, drag out the image slot and text banner zones directly on the image, style controls (font color, gradient direction/opacity), save multiple named templates. |
| **Trend discovery (RSS)** | ✅ Hespress, Le360, H24Info, Akhbarona feeds parsed and normalized; tolerant of individual feed failures. |
| **Virality scoring** | ✅ Momentum, emotional-category keyword detection, recency decay, cross-source saturation penalty → 0–100 score + human-readable explanation. |
| **Multi-AI caption generator** | ✅ Unified router for Claude / GPT / Mistral / Gemini / Grok behind one interface; "Compare All" mode; 5 tone variants × 3 language options + hashtags + suggested post time. |
| **Encrypted API-key vault** | ✅ AES-256-GCM at rest, per-provider, Settings UI, keys never logged or echoed back. |
| **Dashboard UI** | ✅ Ranked trend list → caption generation modal → template + headline + photo → live render preview → download. |
| Google Trends / X / YouTube / Reddit sources | 🚧 Not wired — `RSS_SOURCES` in `server/src/services/trends/sources.ts` is the extension point; each would become its own source module feeding the same `NormalizedTrend` shape. |
| Facebook Graph API (Page Insights, OAuth, direct publish) | 🚧 Not implemented — publishing today is "download + copy caption"; see `docs/SPEC.md` §5 for the target flow. |
| Scheduling / content calendar | 🚧 Schema has a `status`/`scheduled_for` column on `generated_posts` (see `docs/schema.sql`) but no queue worker yet. |
| Production Postgres | 🚧 Dev server uses bundled SQLite (zero setup). `docs/schema.sql` is the Postgres-equivalent schema for swapping in production — see below. |

---

## Architecture

```
client/   React + Vite + Tailwind — dashboard, template editor, settings
server/   Node + Express + TypeScript
  src/services/trends/    RSS ingestion + normalization + virality scoring
  src/services/ai/        Provider adapters (anthropic/openai/mistral/google/xai)
                           behind one router: {trend, tone, language, provider} -> captions
  src/services/render/    Sharp-based compositing engine + SVG text/gradient layer
  src/services/crypto.ts  AES-256-GCM API-key encryption
  src/routes/             /api/trends, /api/ai, /api/settings, /api/templates, /api/render
  src/db/                 SQLite (dev) — schema mirrors docs/schema.sql (Postgres, prod)
docs/
  SPEC.md      the original product spec
  schema.sql   production Postgres schema
```

### Rendering pipeline (`server/src/services/render/renderEngine.ts`)

1. Photo is cover-fit and cropped to the template's **image slot** rectangle.
2. A gradient overlay + the headline are rendered as one SVG layer over the
   **text zone** rectangle. Headline auto-sizes and wraps to 1–2 lines
   (`textFit.ts`), with a wider glyph-width heuristic for Arabic script.
3. The template's base frame image is composited **last**, on top — so
   border/branding elements stay crisp over the photo, per spec.
4. The result is flattened and resized to the requested Facebook export
   size (defaults to 1080×1080).

### AI router (`server/src/services/ai/router.ts`)

`generateCaptions({provider, trend, language, tones})` decrypts that
provider's stored key, calls its adapter (`services/ai/providers/*.ts`), and
normalizes the response into a shared `CaptionResult` shape. `POST
/api/ai/generate` with no `provider` fans this out across every configured
provider at once ("Compare All"), returning per-provider success/failure so
the UI can show an "add your API key" prompt for anything unconfigured.

---

## Getting started

Requires Node 20+.

```bash
# 1. Server
cd server
cp .env.example .env
# generate a MASTER_KEY for the API-key vault:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# paste it into .env as MASTER_KEY=...
npm install
npm run dev        # http://localhost:4000

# 2. Client (separate terminal)
cd client
npm install
npm run dev         # http://localhost:5173 (proxies /api and /static to :4000)
```

Then open http://localhost:5173:
1. **Settings** — paste API key(s) for whichever AI providers you have.
2. **Templates** — upload your branded frame image, drag out the image slot
   and text banner, save.
3. **Dashboard** — trending topics (once RSS feeds are reachable from your
   network) → generate captions → render onto your template → download.

### Running tests

```bash
cd server && npm test        # renderEngine end-to-end compositing test (vitest)
```

### Production DB (Postgres)

The dev server runs on a bundled SQLite file (`server/data/trendpost.db`,
auto-created) so the whole project runs with zero external services. For
production, `docs/schema.sql` is the equivalent Postgres schema (same
tables/columns); point the server's DB layer (`server/src/db/`) at
`DATABASE_URL` and swap `better-sqlite3` calls for a `pg` pool using that
schema. `docker-compose.yml` spins up a local Postgres pre-loaded with it
for testing that swap.

---

## Notes on RSS sources

`server/src/services/trends/sources.ts` lists best-effort public feed URLs
for major Moroccan outlets. Outlets occasionally restructure their sites, so
verify feed URLs periodically — `fetchAllTrends()` is resilient to any
individual feed being down (`Promise.allSettled`) and simply returns fewer
results rather than failing the whole request.

## Security

- AI provider API keys are encrypted at rest with AES-256-GCM
  (`server/src/services/crypto.ts`), keyed by a `MASTER_KEY` env var never
  committed to the repo. Keys are never logged and the settings API never
  echoes key material back — only a `configured: true/false` flag per
  provider.
- Uploaded images are validated by MIME type and size-capped (15MB) via
  multer (`server/src/middleware/upload.ts`).
