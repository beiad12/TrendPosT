-- Dev/local schema (SQLite). Mirrors docs/schema.sql (Postgres, for production).

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'news',
  base_image_path TEXT NOT NULL,
  canvas_width INTEGER NOT NULL,
  canvas_height INTEGER NOT NULL,
  image_slot_json TEXT NOT NULL,      -- {x,y,width,height}
  text_zone_json TEXT NOT NULL,       -- {x,y,width,height,align}
  style_json TEXT NOT NULL,           -- {fontFamily,fontColor,fontWeight,gradientDirection,gradientOpacity,...}
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trends_cache (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT,
  published_at TEXT,
  language TEXT,
  category TEXT,
  score REAL,
  score_explanation TEXT,
  raw_json TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generated_posts (
  id TEXT PRIMARY KEY,
  trend_id TEXT,
  template_id TEXT,
  provider TEXT,
  language TEXT,
  caption TEXT,
  hashtags TEXT,
  image_export_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | scheduled | published
  scheduled_for TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  provider TEXT PRIMARY KEY, -- anthropic | openai | mistral | google | xai
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
