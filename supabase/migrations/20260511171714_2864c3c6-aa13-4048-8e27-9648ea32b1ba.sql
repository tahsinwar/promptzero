
CREATE OR REPLACE FUNCTION public.sync_sub_prompts(p_id uuid, items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kept_ids uuid[];
  item jsonb;
  idx int := 0;
  item_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(array_agg((elem->>'id')::uuid) FILTER (WHERE elem ? 'id' AND NULLIF(elem->>'id','') IS NOT NULL), ARRAY[]::uuid[])
    INTO kept_ids
  FROM jsonb_array_elements(items) elem;

  DELETE FROM public.sub_prompts
   WHERE prompt_id = p_id
     AND NOT (id = ANY(kept_ids));

  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    item_id := NULLIF(item->>'id','')::uuid;
    IF item_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.sub_prompts WHERE id = item_id AND prompt_id = p_id) THEN
      UPDATE public.sub_prompts SET
        title = COALESCE(item->>'title',''),
        content = COALESCE(item->>'content',''),
        description = NULLIF(item->>'description',''),
        ai_models = COALESCE(ARRAY(SELECT jsonb_array_elements_text(item->'ai_models')), '{}'::text[]),
        difficulty = NULLIF(item->>'difficulty',''),
        notes = NULLIF(item->>'notes',''),
        display_order = idx,
        updated_at = now()
      WHERE id = item_id;
    ELSE
      INSERT INTO public.sub_prompts (prompt_id, title, content, description, ai_models, difficulty, notes, display_order)
      VALUES (
        p_id,
        COALESCE(item->>'title',''),
        COALESCE(item->>'content',''),
        NULLIF(item->>'description',''),
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(item->'ai_models')), '{}'::text[]),
        NULLIF(item->>'difficulty',''),
        NULLIF(item->>'notes',''),
        idx
      );
    END IF;
    idx := idx + 1;
  END LOOP;
END;
$$;
