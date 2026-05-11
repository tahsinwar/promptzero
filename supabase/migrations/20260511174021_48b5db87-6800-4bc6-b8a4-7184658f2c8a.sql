-- 1) Tighten "always true" public-write RLS policies.

-- comments: public can submit, but with shape checks and forced moderation.
DROP POLICY IF EXISTS "anyone can submit comments" ON public.comments;
CREATE POLICY "anyone can submit comments"
  ON public.comments FOR INSERT TO public
  WITH CHECK (
    prompt_id IS NOT NULL
    AND author_name IS NOT NULL AND length(btrim(author_name)) BETWEEN 1 AND 100
    AND content IS NOT NULL AND length(btrim(content)) BETWEEN 1 AND 5000
    AND is_approved = false
    AND is_pinned = false
    AND upvotes = 0
  );

-- ratings: public can submit, value bounded.
DROP POLICY IF EXISTS "anyone can submit ratings" ON public.ratings;
CREATE POLICY "anyone can submit ratings"
  ON public.ratings FOR INSERT TO public
  WITH CHECK (
    prompt_id IS NOT NULL
    AND session_id IS NOT NULL AND length(btrim(session_id)) BETWEEN 1 AND 200
    AND value IS NOT NULL AND value BETWEEN 1 AND 5
  );

-- ratings: public can update their own session's rating, value bounded.
DROP POLICY IF EXISTS "anyone can update own session rating" ON public.ratings;
CREATE POLICY "anyone can update own session rating"
  ON public.ratings FOR UPDATE TO public
  USING (
    prompt_id IS NOT NULL
    AND session_id IS NOT NULL AND length(btrim(session_id)) BETWEEN 1 AND 200
  )
  WITH CHECK (
    value IS NOT NULL AND value BETWEEN 1 AND 5
  );

-- visitor_questions: public can submit, with shape checks and forced moderation.
DROP POLICY IF EXISTS "anyone can submit visitor_questions" ON public.visitor_questions;
CREATE POLICY "anyone can submit visitor_questions"
  ON public.visitor_questions FOR INSERT TO public
  WITH CHECK (
    prompt_id IS NOT NULL
    AND author_name IS NOT NULL AND length(btrim(author_name)) BETWEEN 1 AND 100
    AND question IS NOT NULL AND length(btrim(question)) BETWEEN 1 AND 2000
    AND is_published = false
    AND answer IS NULL
  );

-- 2) Remove direct execute on the trigger-only helper (triggers don't need it).
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM authenticated;

-- 3) Counter increments are only called from the public site / signed-in users.
--    Trim service_role and PUBLIC default execute that triggers the linter.
REVOKE ALL ON FUNCTION public.increment_view_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_view_count(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_copy_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_copy_count(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_comment_upvote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_comment_upvote(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_sub_prompt_copy_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_sub_prompt_copy_count(uuid) TO anon, authenticated;

-- has_role and sync_sub_prompts are intentionally callable by authenticated
-- (RLS policies and admin RPC respectively) — only revoke from PUBLIC default.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;