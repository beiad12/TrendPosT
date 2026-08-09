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
3. The result is flattened and resized to the requested Facebook export
   size (defaults to the template's own canvas size, e.g. 1080×1080).

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
cd server && npm test        # renderEngine end-to-end compositing test (vitest)
```

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
