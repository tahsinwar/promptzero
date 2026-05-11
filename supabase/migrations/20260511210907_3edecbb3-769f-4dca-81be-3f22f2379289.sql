CREATE INDEX IF NOT EXISTS idx_comments_prompt_approved_pinned_created
  ON public.comments (prompt_id, is_approved, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visitor_questions_prompt_published_created
  ON public.visitor_questions (prompt_id, is_published, created_at DESC);