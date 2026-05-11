ALTER TABLE public.sub_prompts
  ADD COLUMN IF NOT EXISTS copy_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_sub_prompt_copy_count(s_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sub_prompts SET copy_count = copy_count + 1 WHERE id = s_id;
  UPDATE public.prompts p
     SET copy_count = copy_count + 1
    FROM public.sub_prompts s
   WHERE s.id = s_id AND p.id = s.prompt_id;
END;
$$;