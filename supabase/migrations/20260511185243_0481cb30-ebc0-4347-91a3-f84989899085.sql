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
  new_fill_in_enabled boolean;
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
    new_fill_in_enabled := COALESCE((item->>'fill_in_enabled')::boolean, true);

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
        OR existing.notes IS DISTINCT FROM new_notes
        OR existing.fill_in_enabled IS DISTINCT FROM new_fill_in_enabled;

      IF content_changed THEN
        UPDATE public.sub_prompts SET
          title = new_title,
          content = new_content,
          description = new_description,
          ai_models = new_ai_models,
          difficulty = new_difficulty,
          notes = new_notes,
          fill_in_enabled = new_fill_in_enabled,
          display_order = idx,
          updated_at = now()
        WHERE id = item_id;
      ELSIF existing.display_order IS DISTINCT FROM idx THEN
        UPDATE public.sub_prompts SET display_order = idx WHERE id = item_id;
      END IF;
    ELSE
      INSERT INTO public.sub_prompts (prompt_id, title, content, description, ai_models, difficulty, notes, fill_in_enabled, display_order)
      VALUES (
        p_id,
        new_title,
        new_content,
        new_description,
        new_ai_models,
        new_difficulty,
        new_notes,
        new_fill_in_enabled,
        idx
      );
    END IF;
    idx := idx + 1;
  END LOOP;
END;
$function$;