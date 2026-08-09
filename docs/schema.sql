-- TrendPost production schema (PostgreSQL)
-- The bundled dev server uses an equivalent SQLite schema
-- (server/src/db/schema.sqlite.sql) so the project runs with zero
-- external services locally. Point the server at Postgres in production
-- by setting DATABASE_URL and swapping the db adapter (server/src/db).

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT DEFAULT 'news',
  base_image_path TEXT NOT NULL,   -- locked, pixel-perfect background artwork (bottom layer)
  canvas_width INTEGER NOT NULL,
  canvas_height INTEGER NOT NULL,
  zones_json JSONB NOT NULL,       -- ZoneDef[] -- reusable layer system (text/photo zones, any count)
  style_json JSONB NOT NULL,       -- {canvasBackground?}
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

-- Singleton row (id always 1): the page's logo, stamped onto every rendered
-- post regardless of which template is used.
CREATE TABLE IF NOT EXISTS branding (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  logo_path TEXT,
  position TEXT NOT NULL DEFAULT 'bottom-right', -- bottom-right | bottom-left | top-right | top-left
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every raw article the trend engine has ever fetched from any provider
-- (Google News, GDELT, publisher RSS, Reddit), deduped by id (a hash of its
-- cleaned URL). Real velocity tracking + stale-while-revalidate cache --
-- see server/src/db/schema.sqlite.sql for the full rationale.
CREATE TABLE IF NOT EXISTS trend_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  source_domain TEXT,
  published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL,
  language TEXT,
  country TEXT,
  category_hint TEXT,
  description TEXT,
  image_url TEXT,
  keywords_json JSONB NOT NULL DEFAULT '[]',
  provider TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trend_articles_discovered ON trend_articles (discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_trends_score ON trends_cache (score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status ON generated_posts (status);
