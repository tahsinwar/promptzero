CREATE OR REPLACE FUNCTION public.sync_sub_prompts(p_id uuid, items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  kept_ids uuid[];
  item jsonb;
  idx int := 0;
  item_id uuid;
  existing public.sub_prompts%ROWTYPE;
  new_title text;
  new_content text;
  new_description text;
  new_ai_models text[];
  new_difficulty text;
  new_notes text;
  content_changed boolean;
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
    new_title := COALESCE(item->>'title','');
    new_content := COALESCE(item->>'content','');
    new_description := NULLIF(item->>'description','');
    new_ai_models := COALESCE(ARRAY(SELECT jsonb_array_elements_text(item->'ai_models')), '{}'::text[]);
    new_difficulty := NULLIF(item->>'difficulty','');
    new_notes := NULLIF(item->>'notes','');

    IF item_id IS NOT NULL THEN
      SELECT * INTO existing FROM public.sub_prompts WHERE id = item_id AND prompt_id = p_id;
    ELSE
      existing := NULL;
    END IF;

    IF existing.id IS NOT NULL THEN
      content_changed :=
        existing.title IS DISTINCT FROM new_title
        OR existing.content IS DISTINCT FROM new_content
        OR existing.description IS DISTINCT FROM new_description
        OR existing.ai_models IS DISTINCT FROM new_ai_models
        OR existing.difficulty IS DISTINCT FROM new_difficulty
        OR existing.notes IS DISTINCT FROM new_notes;

      IF content_changed THEN
        -- Full update: content fields changed, bump updated_at. created_at preserved.
        UPDATE public.sub_prompts SET
          title = new_title,
          content = new_content,
          description = new_description,
          ai_models = new_ai_models,
          difficulty = new_difficulty,
          notes = new_notes,
          display_order = idx,
          updated_at = now()
        WHERE id = item_id;
      ELSIF existing.display_order IS DISTINCT FROM idx THEN
        -- Only ordering changed: touch display_order alone.
        -- Leave created_at AND updated_at untouched so reorder doesn't churn timestamps.
        UPDATE public.sub_prompts SET
          display_order = idx
        WHERE id = item_id;
      END IF;
      -- else: nothing changed, skip write entirely
    ELSE
      INSERT INTO public.sub_prompts (prompt_id, title, content, description, ai_models, difficulty, notes, display_order)
      VALUES (
        p_id,
        new_title,
        new_content,
        new_description,
        new_ai_models,
        new_difficulty,
        new_notes,
        idx
      );
    END IF;
    idx := idx + 1;
  END LOOP;
END;
$function$;