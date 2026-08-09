# TrendPost / "Maroc Viral" Engine — Full Product Spec

### Overview
A web dashboard that detects trending topics and news from Moroccan media and social platforms, scores them for viral potential, generates ready-to-post Facebook captions using a choice of AI providers, and renders the final post image using the user's branded template (photo + auto-fit headline banner) — ready to download or auto-publish.

---

### 1. Trend Discovery Module (Morocco-focused)

**Sources:**
- **RSS feeds (primary)**: Hespress, Le360, H24Info, Akhbarona, and other Moroccan news sites that publish public feeds
- **Google Trends** — filtered to Morocco (`geo=MA`)
- **X/Twitter API** — trending hashtags filtered by Morocco location/language (Arabic/French/Darija)
- **Facebook Graph API** — user's own Page Insights (post history performance)
- **YouTube Trending** — Morocco region
- **Reddit** (r/Morocco) — lower priority
- **Scraping** — fallback only, for sites without RSS; rate-limited, robots.txt-respecting, source link always preserved

**Data captured per trend:** topic/title, source, timestamp, source URL, associated image, engagement numbers (if available), detected language (Arabic / Darija / French)

---

### 2. Virality Scoring Engine

Score 0–100 based on:
- **Momentum** — mentions/shares per hour (rising/flat/declining)
- **Emotional category** — outrage, humor, national pride, shock, sports, celebrity/gossip
- **Recency** — decay function, older news scores lower
- **Saturation** — how many other pages already posted it
- **Historical fit** — compared to user's own top-performing past posts (if FB Page connected)

Each trend shown with score + short explanation (e.g. "🔥 Rising fast, low saturation, high emotional pull")

---

### 3. Multi-AI Caption Generator

User selects which AI generates the caption, or runs "Compare All":

| Provider | Model | Notes |
|---|---|---|
| Anthropic | Claude | Nuanced tone, strong French/Arabic quality |
| OpenAI | GPT | Fast, widely used baseline |
| Mistral | Mistral Large/Small | Strong French performance |
| Google | Gemini | Good multilingual support |
| xAI | Grok | Casual/edgy tone, good for meme-style posts |

**API keys**: Users bring their own key per provider, entered in a Settings page, stored encrypted (AES-256 at rest), never logged. Missing/invalid key disables that provider in the UI with an "add your API key" prompt.

**Each generation includes:**
- 3–5 caption variants (funny / informative / question-hook / emotional / controversial-safe)
- Language variants (Darija / French / MSA Arabic)
- Suggested hashtags (trending + evergreen Moroccan tags)
- Suggested best posting time (based on FB Insights if connected)

**Backend requirement**: unified internal AI-router service — takes `{trend, tone, language, provider}` and calls the selected provider's API, normalizing responses across all five.

---

### 4. Template & Image Rendering System

**Upload button**: user uploads their branded template image (e.g. "Maroc Viral" frame)

**Template editor:**
- Drag-to-define the **image slot** (where the trend photo goes)
- Drag-to-define the **text banner zone** (overlay area on the photo, bottom third typically)
- Save style presets: font, color, gradient direction/opacity, alignment
- Save multiple templates (e.g. "News," "Sports," "Meme")

**Rendering pipeline:**
1. Background = template frame (fixed elements untouched)
2. Photo fetched from source article (or user upload) → cropped/fit to image slot
3. Gradient overlay rendered on bottom third of photo (for text readability)
4. Headline text rendered on top — bold, auto-sized/auto-wrapped to 1–2 lines, chosen language
5. Frame border (part of base template) stays on top — final flattened export

**Output**: PNG/JPG, sized for Facebook feed (e.g. 1254×1254 or 1080×1080)

---

### 5. Publishing / Export

- Download final image
- Copy caption + hashtags to clipboard
- Direct publish to Facebook Page via Graph API (OAuth connect once)
- Optional content calendar/queue: schedule posts, auto-publish at suggested best times

---

### 6. Tech Stack

- **Frontend**: React + Tailwind, Fabric.js/Canvas API for template zone editor + live preview
- **Backend**: Node.js (Express/Fastify) or Python (FastAPI)
- **AI routing layer**: internal service abstracting Claude, GPT, Mistral, Gemini, Grok behind one interface
- **Image rendering**: Sharp (Node) or Pillow (Python)
- **Trend/RSS parsing**: RSS parser libraries; Playwright/Puppeteer only for scraping fallback
- **Trend APIs**: Google Trends (pytrends), X API, YouTube Data API, Facebook Graph API
- **Auth**: Meta OAuth for Facebook publishing; encrypted key vault for user-supplied AI API keys
- **DB**: Postgres — templates, trend history, generated posts, scheduling queue
- **Storage**: S3-compatible bucket for template images and generated exports

---

### 7. User Flow

1. Dashboard loads → trending Moroccan topics ranked by virality score, with source + thumbnail
2. Click a trend → choose AI provider(s) → generate caption variants → pick/edit, choose language
3. Choose saved template (or upload new) → photo auto-pulled from trend source (or upload own) → auto-fills into slot with headline banner
4. Live preview → adjust text/position/font if needed
5. Export image + copy caption, or schedule/direct-publish to Facebook Page
