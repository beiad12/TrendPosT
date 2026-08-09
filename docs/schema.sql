-- TrendPost production schema (PostgreSQL)
-- The bundled dev server uses an equivalent SQLite schema
-- (server/src/db/schema.sqlite.sql) so the project runs with zero
-- external services locally. Point the server at Postgres in production
-- by setting DATABASE_URL and swapping the db adapter (server/src/db).

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT DEFAULT 'news',
  base_image_path TEXT NOT NULL,
  canvas_width INTEGER NOT NULL,
  canvas_height INTEGER NOT NULL,
  image_slot_json JSONB NOT NULL,
  text_zone_json JSONB NOT NULL,
  style_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trends_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  language TEXT,
  category TEXT,
  score REAL,
  score_explanation TEXT,
  raw_json JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_id UUID REFERENCES trends_cache(id),
  template_id UUID REFERENCES templates(id),
  provider TEXT,
  language TEXT,
  caption TEXT,
  hashtags TEXT[],
  image_export_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | scheduled | published
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  provider TEXT PRIMARY KEY, -- anthropic | openai | mistral | google | xai
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trends_score ON trends_cache (score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status ON generated_posts (status);
