ALTER TABLE public.prompt_links ADD COLUMN IF NOT EXISTS link_clicks integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_link_clicks(l_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.prompt_links SET link_clicks = link_clicks + 1 WHERE id = l_id;
END;
$$;