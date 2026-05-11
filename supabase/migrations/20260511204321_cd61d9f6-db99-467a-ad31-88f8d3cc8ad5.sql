-- Enable trigram extension for fast ILIKE on title
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Sort by created_at desc (default ordering)
CREATE INDEX IF NOT EXISTS idx_prompts_created_at_desc
  ON public.prompts (created_at DESC);

-- Filter by status
CREATE INDEX IF NOT EXISTS idx_prompts_status
  ON public.prompts (status);

-- Filter by category (skip rows where category is null)
CREATE INDEX IF NOT EXISTS idx_prompts_category_id
  ON public.prompts (category_id)
  WHERE category_id IS NOT NULL;

-- Trigram index on lowercased title for ILIKE '%term%'
CREATE INDEX IF NOT EXISTS idx_prompts_title_trgm
  ON public.prompts USING gin (lower(title) gin_trgm_ops);

-- Composite to accelerate common admin pattern: status filter + newest first
CREATE INDEX IF NOT EXISTS idx_prompts_status_created_at
  ON public.prompts (status, created_at DESC);

-- Public site frequently filters is_published = true; partial index keeps it small
CREATE INDEX IF NOT EXISTS idx_prompts_published_created_at
  ON public.prompts (created_at DESC)
  WHERE is_published = true;

ANALYZE public.prompts;