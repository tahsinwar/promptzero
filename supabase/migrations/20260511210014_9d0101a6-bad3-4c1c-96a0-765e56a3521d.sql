
-- get_home_stats: returns prompts count, distinct tool count, total copies in one round-trip
CREATE OR REPLACE FUNCTION public.get_home_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'prompts', (SELECT count(*) FROM public.prompts WHERE is_published = true),
    'tools', (
      SELECT count(DISTINCT m)
      FROM public.prompts p, unnest(coalesce(p.ai_models, '{}'::text[])) AS m
      WHERE p.is_published = true AND m <> ''
    ),
    'copies', (SELECT coalesce(sum(copy_count), 0) FROM public.prompts WHERE is_published = true)
  );
$$;

-- get_prompt_detail: returns prompt + nested rels + comments + visitor Qs + version count + ratings in one JSON
CREATE OR REPLACE FUNCTION public.get_prompt_detail(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prompt public.prompts%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_prompt FROM public.prompts WHERE slug = p_slug AND is_published = true LIMIT 1;
  IF v_prompt.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'prompt', to_jsonb(v_prompt)
      || jsonb_build_object(
        'categories', (SELECT to_jsonb(c) FROM public.categories c WHERE c.id = v_prompt.category_id),
        'prompt_tags', coalesce((
          SELECT jsonb_agg(jsonb_build_object('tags', to_jsonb(t)))
          FROM public.prompt_tags pt JOIN public.tags t ON t.id = pt.tag_id
          WHERE pt.prompt_id = v_prompt.id
        ), '[]'::jsonb),
        'prompt_videos', coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.display_order) FROM public.prompt_videos v WHERE v.prompt_id = v_prompt.id), '[]'::jsonb),
        'prompt_links',  coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.display_order) FROM public.prompt_links l WHERE l.prompt_id = v_prompt.id), '[]'::jsonb),
        'prompt_qa',     coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.display_order) FROM public.prompt_qa q WHERE q.prompt_id = v_prompt.id), '[]'::jsonb),
        'sub_prompts',   coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.display_order) FROM public.sub_prompts s WHERE s.prompt_id = v_prompt.id), '[]'::jsonb)
      ),
    'comments', coalesce((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.is_pinned DESC, c.created_at DESC)
      FROM public.comments c
      WHERE c.prompt_id = v_prompt.id AND c.is_approved = true
    ), '[]'::jsonb),
    'visitorQs', coalesce((
      SELECT jsonb_agg(to_jsonb(vq) ORDER BY vq.created_at DESC)
      FROM public.visitor_questions vq
      WHERE vq.prompt_id = v_prompt.id AND vq.is_published = true
    ), '[]'::jsonb),
    'versionCount', (SELECT count(*) + 1 FROM public.prompt_versions WHERE prompt_id = v_prompt.id),
    'ratings', coalesce((
      SELECT jsonb_agg(jsonb_build_object('value', r.value))
      FROM public.ratings r WHERE r.prompt_id = v_prompt.id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_home_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_prompt_detail(text) TO anon, authenticated;
