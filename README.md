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
| **AI Auto Post (one click, nothing manual)** | ✅ `POST /api/auto-post` — pick a trend, and the AI does everything: fetches the trend's own photo, writes a punchy headline for it, and renders the two together onto a full-bleed "press poster" template (photo + gradient + headline, no manual upload or typing). Shown as the default tab whenever you open a trend. See "AI Auto Post" below. |
| **Template & image rendering engine** | ✅ Layer-based: any number of text/photo zones, each with its own alignment/weight/color, composited on top of a **locked, pixel-perfect background artwork** — your upload never needs any special transparency to work. `**word**` → per-zone highlight color, auto-fit/auto-wrap via real font metrics (Pango), correct Arabic shaping (Cairo) and Latin (Montserrat), flattened export at Facebook feed size. |
| **Template editor UI** | ✅ Upload any PNG/JPG as the background, add as many text or photo zones as your design needs, drag each into place, configure per-zone alignment/weight/color/highlight-color/locked/default-value/pill-background. Not hardcoded to any fixed shape — a "Quick add" preset just pre-fills the common Photo/Category/Headline/Description/CTA set. |
| **AI zone detection** | ✅ "✨ Auto-detect zones with AI" — Claude's vision looks at your uploaded artwork and proposes a starting set of zones (photo + text placeholders, with type/alignment inferred) instead of dragging every rectangle by hand; you review/adjust before saving. Requires an Anthropic key in Settings. |
| **"Maroc Viral" brand template** | ✅ The brand's actual design system (colors, gradients, Cairo/Montserrat fonts, layout) implemented as a real, working 5-zone template (Photo, Category, Headline, Description, CTA) — auto-seeded on first boot in Arabic + French. See "The Maroc Viral template" below. |
| **Trend engine (provider-based, multi-source)** | ✅ A real "what's worth posting right now" engine, not an RSS reader: Google News search + GDELT + Moroccan publisher RSS feeds (optionally Reddit) are fetched independently, normalized, deduped, **clustered into one trend per real-world story** (multi-outlet corroboration counted once), then scored 0–100 on freshness/source-count/velocity/Morocco-relevance/category/viral-potential. Every provider tracks its own health (healthy/degraded/unavailable/not_configured) with backoff, so a dead endpoint never crashes the dashboard or spams retries. See "Trend engine" below. |
| **Virality scoring, explainable** | ✅ Weighted 0–100 score (freshness, source count, velocity, Morocco relevance, social, category, viral potential) with a per-factor breakdown shown in the UI — not a black-box number. Classifies each trend as BREAKING / RISING / VIRAL / POPULAR / STABLE. |
| **Multi-AI caption generator** | ✅ Unified router for Claude / GPT / Mistral / Gemini / Grok behind one interface; "Compare All" mode; 5 tone variants × 3 language options + hashtags + suggested post time. |
| **Encrypted API-key vault** | ✅ AES-256-GCM at rest, per-provider, Settings UI, keys never logged or echoed back. |
| **Page logo watermark** | ✅ Upload your page's logo once in Settings; it's stamped automatically onto every rendered post (AI Auto Post *and* manual templates) at a configurable corner — no per-post setup. See "Page logo" below. |
| **4K render quality** | ✅ Final exports default to a true 4K scale (3840px long edge), not the 1080px design-canvas size — every zone (text, photo, gradient, pill) renders natively at that resolution instead of an upscaled-afterward blur. |
| **World map country picker** | ✅ Click any of ~175 countries on a real interactive map (or use the dropdown) to fetch that country's own trending news — its own Google News + GDELT fetch, its own cache, its own relevance scoring (against *that* country's name, not always Morocco's). The Morocco-and-world home dashboard is untouched by this. See "Trend engine — country picker" below. |
| **Dashboard UI** | ✅ Ranked trend list → caption generation modal → template + headline + photo → live render preview → download. |
| X/Twitter trending source | 🚧 Not wired — X's trending-topics data requires a paid API tier (no free/no-key public endpoint exists the way Google News/GDELT have one). The extension point is documented in `server/src/services/trends/aggregator... engine.ts` and `providers/index.ts`; it's intentionally not stubbed with fake data. |
| Google Trends | 🚧 Google discontinued the free public "daily trends" RSS this project used to call (now 404s everywhere) — there's no other free/no-key replacement. Reports `not_configured` rather than being faked; wired as a real optional provider (`providers/googleTrends.ts`) ready for a paid Trends API integration. |
| Facebook Graph API (Page Insights, OAuth, direct publish) | 🚧 Not implemented — publishing today is "download + copy caption"; see `docs/SPEC.md` §5 for the target flow. |
| Scheduling / content calendar | 🚧 Schema has a `status`/`scheduled_for` column on `generated_posts` (see `docs/schema.sql`) but no queue worker yet. |
| Production Postgres | 🚧 Dev server uses bundled SQLite (zero setup). `docs/schema.sql` is the Postgres-equivalent schema for swapping in production — see below. |

---

## Architecture

```
client/   React + Vite + Tailwind — dashboard, template editor, settings
server/   Node + Express + TypeScript
  src/services/trends/    Provider-based trend engine — see "Trend engine" below
    providers/             Google News, GDELT, publisher RSS, Reddit*, Google Trends* (*optional)
    engine.ts               orchestrator: fetch -> persist -> cluster -> score -> cache/fallback
    clustering.ts, scoring.ts, normalize.ts, sourceHealth.ts, articleStore.ts
  src/services/brandingStore.ts  Global page-logo settings (singleton row), used by the render pipeline
  src/services/ai/        Provider adapters (anthropic/openai/mistral/google/xai)
                           behind one router: {trend, tone, language, provider} -> captions
  src/services/render/    Sharp-based compositing engine + SVG text/gradient layer
  src/services/crypto.ts  AES-256-GCM API-key encryption
  src/routes/             /api/trends, /api/ai, /api/settings, /api/templates, /api/render
  src/db/                 node:sqlite (dev, no native deps) — schema mirrors docs/schema.sql (Postgres, prod)
docs/
  SPEC.md      the original product spec
  schema.sql   production Postgres schema
```

### Rendering pipeline (`server/src/services/render/renderEngine.ts`)

Templates are a **reusable layer system** (`Template.zones: ZoneDef[]`), not
a fixed set of named rectangles — any template can define any number of
`text` or `photo` zones:

1. The uploaded background artwork is composited **pixel-perfect as the
   bottom layer** — it is never expected to have real alpha transparency; a
   fully flattened PNG/JPG export from any design tool works, because every
   zone below draws strictly **on top** of it.
2. Each zone, in the template's defined paint order, is composited on top:
   - **photo zones** are cover-fit + cropped to their box.
   - **text zones** are rendered with real brand fonts — Cairo for Arabic,
     Montserrat for Latin, auto-picked per zone from the actual content's
     script — via `sharp`'s Pango-based text renderer (`richText.ts`), with
     native auto-fit/auto-wrap sized to the zone (real font metrics, no
     hand-rolled width heuristics), `**word**` → per-zone highlight color,
     an optional fixed `prefix` (e.g. a "●" category dot), and an optional
     auto-width **pill** background that hugs the actual rendered text size
     (for CTA-button-style zones).
   - **locked** zones always render their fixed `defaultValue` and are not
     exposed as editable inputs in the client.
3. **Everything renders natively at final export resolution** — a template
   is authored at a modest design-canvas size (e.g. 1080×1080, easy to
   eyeball while building a layout), but that is never the export size.
   Every zone's coordinates are scaled up *before* compositing, so text
   (Pango) and SVG layers (pill, gradient) stay genuinely crisp at any
   size, and photo zones are resampled straight from their original
   resolution to the final pixel size — never a blurry after-the-fact
   upscale of an already-small composite. Output defaults to a true **4K
   export (3840px on the long edge)**, aspect-ratio preserved
   (`computeDefaultOutputSize`); pass `outputWidth`/`outputHeight`
   explicitly for a different size. JPEG exports use quality 95 +
   4:4:4 chroma subsampling + mozjpeg for crisp text edges (the default
   4:2:0 subsampling visibly softens colored text/logos). Only the
   background artwork's own native resolution is a hard ceiling — a
   1080px upload can't invent detail beyond 1080px, though lanczos3
   resampling makes the most of it.

`server/src/types.ts` (`ZoneDef`, `TextZoneDef`, `PhotoZoneDef`) is the
shared shape the DB (`zones_json`), the render engine, and the client
editor all agree on — adding a new kind of template is just defining a new
zone layout, no code changes required elsewhere.

### AI router (`server/src/services/ai/router.ts`)

`generateCaptions({provider, trend, language, tones})` decrypts that
provider's stored key, calls its adapter (`services/ai/providers/*.ts`), and
normalizes the response into a shared `CaptionResult` shape. `POST
/api/ai/generate` with no `provider` fans this out across every configured
provider at once ("Compare All"), returning per-provider success/failure so
the UI can show an "add your API key" prompt for anything unconfigured.

### AI Auto Post (`server/src/services/ai/autoPost.ts`)

The one-click pipeline: `POST /api/auto-post` takes `{trend: {..., imageUrl}, provider, language}`
and does the rest itself —

1. Fetches the trend's own photo from `trend.imageUrl` server-side (no manual upload).
2. Asks the AI for a punchy headline (the same `generateCaptions` call used elsewhere
   also now returns a dedicated `headline` field — see `promptBuilder.ts` — so this
   reuses the existing provider adapters rather than adding a second AI-calling path).
3. Renders the photo + headline onto the seeded **"AI Auto Post — Photo + Headline"**
   template (`buildPressPosterFrame.ts`): full-bleed photo, a darkening gradient over
   the bottom for readability (`PhotoZoneDef.gradientOverlay`, using the generic zone
   system — no template-specific code), headline on top. The headline zone has no
   fixed `align`; the render engine auto-detects the text's script (Arabic → right,
   Latin → left) instead, so the same template works for any language the AI writes in.
4. Returns the rendered image (base64) together with a full caption + hashtags +
   suggested post time from the same AI call, in one response.

The photo and text fetches run concurrently (`Promise.allSettled`, not raced) so that
if both happen to fail, the reported error explains both reasons instead of only
whichever rejected first. A trend with no captured photo is rejected with a clear
400 before any AI call is made.

This is the default tab whenever you open a trend in the dashboard — the "Compare
captions" and "Manual template" tabs (multi-provider caption comparison, and the full
zone editor covered below) are still there for anyone who wants more control, but
nothing is required beyond picking a trend and clicking generate.

### AI zone detection (`server/src/services/ai/zoneDetection.ts`)

`POST /api/templates/detect-zones` takes an uploaded template image and
sends it to Claude's vision API (`claude-sonnet-5`), asking it to identify
placeholder areas — a photo box, and text zones such as a category
label/badge, headline, description, or CTA button — and return their
bounding boxes as strict JSON, in pixel coordinates against the image size
it was shown. Oversized uploads are downscaled before the request (to stay
under Anthropic's recommended max vision input dimension) and the returned
coordinates are scaled back up to the original resolution. Each detected
zone's `type` (text/photo) is taken directly from the model; a zone's
styling (weight, pill background, category-dot prefix) is inferred from
its `id`/`label` via `detectedZonesToDefs()`.

This is a **first-draft assist**, not a blind-trust step: the detected
zones populate the same editable zone list the manual "+ Text zone" flow
produces, so you review, tweak, or redraw any of them (drag to reposition)
before saving — vision-model coordinate grounding is good but not
pixel-perfect. Requires an Anthropic API key configured in Settings; if
none is set, the endpoint returns `400 {error: "missing_api_key"}` and the
UI prompts you to add one.

### The "Maroc Viral" template

`server/src/services/render/brand.ts` holds the brand's design tokens
(colors, gradients, layout ratios) transcribed from its design-system spec.
`buildMarocViralFrame.ts` renders the actual background artwork — corner
accents, logo wordmark, gradient-bordered content box, footer icon row —
as a locked PNG, plus a `marocViralGeometry()` function that lays out its
**5 zones** using the generic system above: `photo`, `category` (with a
"●" prefix, brand-green), `headline` (`**word**` → brand-green highlight),
`description`, and `cta` (a pill button whose background auto-hugs
whatever CTA text is set — the pill isn't locked to any fixed width, since
CTA copy length varies post to post). `seedTemplates.ts` runs once on
server boot and inserts the Arabic + French variants into the DB if they
aren't there yet — nothing to configure, they just show up in the
Templates list, using exactly the same zone system any custom upload uses.

Fonts are **bundled** (`@fontsource/cairo`, `@fontsource/montserrat` — no
OS-level font install required, works identically on any machine).

**Using your own artwork instead:** if you have your own "Maroc Viral" (or
any other) frame exported from a design tool, upload it on the Templates
page, add zones (or use the "Quick add: Maroc Viral layout" preset to
start from the same Photo/Category/Headline/Description/CTA set), and drag
each into place over your empty content area. Your file is kept
pixel-perfect as the locked background regardless of whether it has real
alpha transparency — every zone always composites on top of it.

---

## Getting started

Requires Node 22.5+ (the server uses Node's built-in `node:sqlite` for local
dev — no native/compiled dependency, so `npm install` works out of the box
on Windows/macOS/Linux with no build tools required). `node:sqlite` needs
`--experimental-sqlite` on Node 22.5–22.12 (unflagged from 22.13+); the
`npm run dev`/`start` scripts set that flag automatically via `NODE_OPTIONS`
so this is transparent regardless of which 22.x you have.

### Windows — one-click install & launch

1. Double-click **`INSTALL.bat`** (installs server + client dependencies and
   creates `server/.env` with a freshly generated `MASTER_KEY` — safe to
   re-run, it never overwrites an existing `.env`).
2. Double-click **`LAUNCH.bat`** — opens the API server and web app each in
   their own terminal window, then opens http://localhost:5173 in your
   browser. Close those two windows to stop it.

### macOS / Linux — one-click install & launch

```bash
./install.sh
./launch.sh
```

### Manual setup (any OS)

```bash
# 1. Server
cd server
npm install
npm run setup-env   # creates .env from .env.example with a generated MASTER_KEY
npm run dev          # http://localhost:4000

# 2. Client (separate terminal)
cd client
npm install
npm run dev           # http://localhost:5173 (proxies /api and /static to :4000)
```

Then open http://localhost:5173:
1. **Settings** — paste API key(s) for whichever AI providers you have (Anthropic
   is needed for AI Auto Post and AI zone detection specifically).
2. **Dashboard** — click a trend (once RSS feeds are reachable from your network) →
   it opens on **"✨ Auto post (AI)"** → click **"Generate AI post"** → the trend's
   photo + an AI-written headline render automatically → download. No manual steps.
3. *(Optional)* **Templates** — upload your own branded artwork if you want a
   different look than the built-in ones, then click "✨ Auto-detect zones with AI"
   to have Claude propose a starting layout, or add zones manually / use the
   Maroc Viral quick-add preset.

### Running tests

```bash
cd server && npm test
```

62 tests: the renderEngine end-to-end compositing test, plus the trend
engine's suite (normalization, clustering/dedup, scoring, per-source health
+ backoff, provider failure isolation — 403/404/timeout/malformed JSON all
mocked, no live network required, so `npm test` never depends on any
external site being up). Uses an in-memory SQLite DB (`vitest.config.ts` →
`src/test/setupEnv.ts`) so tests never touch your real dev data.

### Production DB (Postgres)

The dev server runs on a bundled SQLite file (`server/data/trendpost.db`,
auto-created) via Node's built-in `node:sqlite` module — no native/compiled
dependency, so the whole project runs with zero external services and no
platform build tools. For production, `docs/schema.sql` is the equivalent
Postgres schema (same tables/columns); point the server's DB layer
(`server/src/db/`) at `DATABASE_URL` and swap the `node:sqlite` calls for a
`pg` pool using that schema. `docker-compose.yml` spins up a local Postgres
pre-loaded with it for testing that swap.

---

## Trend engine

`server/src/services/trends/` is a provider-based **"what's worth turning
into a Maroc Viral post right now"** engine, not an RSS reader. It answers
that question by running every enabled source, merging what they find into
one deduplicated, scored, ranked list, and never letting one dead source
take the whole dashboard down.

```
Source Providers (Google News, GDELT, Publisher RSS, Reddit*, Google Trends*)
    ↓ normalize.ts     — clean URLs, strip tracking params, Arabic/French text normalization
    ↓ articleStore.ts  — persist to trend_articles (dedup by URL hash; this IS the cache)
    ↓ clustering.ts    — group articles about the same story (title-similarity + time window)
    ↓ scoring.ts        — freshness / sources / velocity / Morocco relevance / category / viral potential → 0-100
    ↓ engine.ts          — orchestrates providers, owns the cache/backoff/fallback logic
    ↓ trendMapper.ts      — flattens a cluster to what the client/AutoPost/AI already consume
GET/POST /api/trends*     — the API surface
```
*optional, gated by config/env

### Providers (`server/src/services/trends/providers/`)

| Provider | id | What it is |
|---|---|---|
| **Google News** | `google_news` | `news.google.com/rss/search` (a *different, still-working* endpoint from the old dead `trendingsearches/daily/rss` one) fanned out across configurable query groups — Morocco Arabic, Morocco French, Maroc viral/buzz, Moroccan sports, and Morocco-international stories (`config.ts#GOOGLE_NEWS_QUERY_GROUPS`). Primary source. |
| **GDELT** | `gdelt` | GDELT DOC 2.0 (`api.gdeltproject.org`), an independent news-monitoring index — free, no key, not affiliated with Google or Reddit. Queried for Morocco/Maroc/politics/sports/entertainment. |
| **Publisher RSS** | `publisher_rss` | Known Moroccan outlets' own feeds (Hespress, Le360, H24Info, Akhbarona, Morocco World News, TelQuel, Médias24 — `sources.ts`), now a *secondary* signal. Each feed is tracked and backed off **individually** — one 403ing feed doesn't affect the others, and it stops being retried every request once it's failed a few times. |
| **Reddit** | `reddit` (optional) | r/Morocco + r/popular via Reddit's real OAuth `client_credentials` flow (their public JSON endpoints now reject most non-browser clients). Requires `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` (free "script" app) — reports `not_configured` and is skipped entirely without them, never an error. |
| **Google Trends** | `google_trends` (disabled) | Google discontinued the free "daily trends" RSS this project used to call. No fake replacement — reports `not_configured` until a real (paid) Trends API is wired into `providers/googleTrends.ts`. |

Add a new source by writing a module implementing `TrendProvider` (`providers/types.ts`) and appending it to `ALL_PROVIDERS` in `providers/index.ts` — nothing else needs to change.

### Resilience

- Every provider is called via `Promise.allSettled` — one failing never blocks another, and the engine never throws on a bad source.
- Per-provider (and per individual RSS feed) **health tracking with exponential backoff** (`sourceHealth.ts`): a failing source is skipped for 30s → 60s → 5min → 15min → 30min instead of being hammered on every request, and flips from `degraded` to `unavailable` after repeated failures.
- **Structured logs**, not error spam: `[TrendEngine] {"provider":"h24info","status":"unavailable","code":403,...}` — one line per event, parseable, never a stack trace for a routine "this source is down" case.
- **Stale-while-revalidate cache**: fetched articles persist to the `trend_articles` table (deduped by a hash of the cleaned URL, original `discovered_at` preserved on refetch). If every live provider fails on a given request, clustering/scoring still runs against whatever's recent in that table — the dashboard shows a `showing_cached`/`no_live_data` warning banner instead of either crashing or silently pretending everything's fine.
- No fake data, ever: if there's genuinely nothing recent, the API returns an empty list and the dashboard shows *"Pas assez de données récentes / لا توجد بيانات كافية حالياً"* — never fabricated trends.

### Clustering & scoring

- **Deduplication**: exact same article (even fetched by two different providers) is merged by a stable id derived from its cleaned URL.
- **Story clustering** (`clustering.ts`): near-duplicate headlines about the same real event — e.g. "Le Maroc annonce une réforme" / "Une réforme annoncée au Maroc" / "Le gouvernement dévoile la réforme" — merge into **one** trend with `sourceCount` counting distinct outlet *domains*, not article count. Uses token-set similarity (with light Arabic/French stemming — Arabic case endings like "مشروعاً" vs "مشروع" are the same word for this purpose) within a rolling time window, not a crude "same first 40 characters" check.
- **Scoring** (`scoring.ts`, weights in `config.ts#SCORE_WEIGHTS`, all sum to 100): Freshness (20, recency-decay curve) + Source Count (20, more independent outlets = stronger signal) + Velocity (20, computed from *real* `discovered_at` history accumulated across fetch cycles — how fast new coverage is actually appearing, not a single snapshot) + Morocco Relevance (15, keyword-weighted) + Social (10, honest proxy — no Facebook Insights API is wired up) + Category (5) + Viral Potential (10, breaking/shock/national-pride/crime/celebrity/etc. keyword signals). Every trend also gets a `trendType`: BREAKING / RISING / VIRAL / POPULAR / STABLE.
- The score is **explainable**, not a black box — the dashboard shows the full per-factor breakdown when you open a trend.

### API

- `GET /api/trends?country=&language=&category=&limit=&minScore=&hours=&status=&refresh=1` — the ranked list, filterable; `refresh=1` bypasses the cache.
- `GET /api/trends/:id?country=` — one trend's full detail: every supporting article, its sources, and the score breakdown.
- `POST /api/trends/refresh?country=` — manually triggers a live refresh across every provider (or just that country's).
- `GET /api/trends/countries` — the full country list the map/picker renders from.

Every response includes `sourceHealth` (what the client's "Trend sources" panel on the dashboard renders) and, when relevant, a `warning` field (`showing_cached` / `no_live_data` / `refresh_failed_showing_cached`).

### Trend engine — country picker

The dashboard defaults to Morocco (`country` omitted or `MA`) — that's the unchanged home feed described above. Passing any other `country` (an ISO 3166-1 alpha-2 code, e.g. `FR`, `JP`, `BR` — see `server/src/services/trends/countries.ts`, ~175 countries) routes to a completely separate fetch/cache path:

- **Providers**: `fetchGoogleNewsForCountry()` / `fetchGdeltForCountry()` (`providers/googleNews.ts` / `providers/gdelt.ts`) build a generic query group from the country's own name (`config.ts#buildCountryQueryGroup`: `"{country}"`, `"{country} news"`, `"{country} today"`, `"breaking news {country}"`, `"{country} sports"`, `"{country} viral"`) rather than the hand-curated Arabic/French keyword lists Morocco gets — writing bespoke keyword sets for 175 countries by hand isn't practical, and this works reasonably well against both Google News and GDELT for any country.
- **Isolation**: each country gets its own `sourceHealth` entries (`google_news:FR`, `gdelt:FR`, ...) and its own cache (`engine.ts#getTrendsForCountry`, keyed by country code) — picking France never touches, refetches, or shows up in Morocco's cache, and vice versa.
- **Relevance scoring**: `scoreCluster()`'s "relevance" factor is generalized to accept a target-country keyword (`scoring.ts#RelevanceKeywords`) — Morocco's dashboard uses its curated keyword set as before; a country-scoped fetch scores relevance against *that* country's own name instead, so a France-relevant story on the France feed still scores full relevance even though it never mentions Morocco.
- **Client**: `WorldMapPicker.tsx` — a real interactive world map (`react-simple-maps` + `world-atlas`'s bundled Natural-Earth topojson, no CDN dependency at runtime) with a dropdown fallback; clicking a country calls `onChange(code)`, which re-fetches the dashboard scoped to it.

## Page logo

Settings → "Page Logo" lets you upload your page's logo once (PNG/JPG/WEBP,
stored under `data/storage/branding/`) and pick a corner
(bottom-right/bottom-left/top-right/top-left). From then on, every rendered
post — both the one-click AI Auto Post flow and manual template renders —
composites that logo on top of everything else automatically
(`renderPost()`'s `watermark` option in `renderEngine.ts`), scaled relative
to the output image size. No per-post setup, and it's optional: skip
uploading one and renders are unaffected.

## Security

- AI provider API keys are encrypted at rest with AES-256-GCM
  (`server/src/services/crypto.ts`), keyed by a `MASTER_KEY` env var never
  committed to the repo. Keys are never logged and the settings API never
  echoes key material back — only a `configured: true/false` flag per
  provider.
- Uploaded images are validated by MIME type and size-capped (15MB) via
  multer (`server/src/middleware/upload.ts`).
