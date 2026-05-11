-- 1) Lock down execute on sync_sub_prompts to authenticated users only.
REVOKE ALL ON FUNCTION public.sync_sub_prompts(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_sub_prompts(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_sub_prompts(uuid, jsonb) TO authenticated;

-- 2) Server-side consistency check (SECURITY INVOKER — respects RLS).
CREATE OR REPLACE FUNCTION public.check_sub_prompt_order(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  total int;
  missing_order int;
  missing_created int;
  dupes int;
  gaps int;
  ok boolean;
BEGIN
  SELECT count(*) INTO total FROM public.sub_prompts WHERE prompt_id = p_id;
  SELECT count(*) INTO missing_order FROM public.sub_prompts WHERE prompt_id = p_id AND display_order IS NULL;
  SELECT count(*) INTO missing_created FROM public.sub_prompts WHERE prompt_id = p_id AND created_at IS NULL;

  SELECT count(*) INTO dupes FROM (
    SELECT display_order FROM public.sub_prompts
     WHERE prompt_id = p_id AND display_order IS NOT NULL
     GROUP BY display_order HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO gaps FROM (
    SELECT row_number() OVER (
             ORDER BY display_order NULLS LAST, created_at NULLS LAST, id
           ) - 1 AS expected,
           display_order
      FROM public.sub_prompts
     WHERE prompt_id = p_id
  ) r
  WHERE r.display_order IS DISTINCT FROM r.expected;

  ok := dupes = 0 AND gaps = 0 AND missing_order = 0;

  RETURN jsonb_build_object(
    'prompt_id', p_id,
    'total', total,
    'duplicates', dupes,
    'gaps_or_mismatches', gaps,
    'missing_display_order', missing_order,
    'missing_created_at', missing_created,
    'consistent', ok
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_sub_prompt_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_sub_prompt_order(uuid) TO anon, authenticated;