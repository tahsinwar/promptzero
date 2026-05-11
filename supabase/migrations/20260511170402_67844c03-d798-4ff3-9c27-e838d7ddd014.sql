-- Create sub_prompts table for multiple prompts under one page
CREATE TABLE public.sub_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  description text,
  ai_models text[] DEFAULT '{}',
  difficulty text,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_prompts_prompt_id ON public.sub_prompts(prompt_id, display_order);

ALTER TABLE public.sub_prompts ENABLE ROW LEVEL SECURITY;

-- Public can read sub_prompts of published prompts
CREATE POLICY "public read sub_prompts of published"
ON public.sub_prompts FOR SELECT
TO public
USING (
  EXISTS (SELECT 1 FROM public.prompts p WHERE p.id = sub_prompts.prompt_id AND p.is_published = true)
);

-- Admins manage all
CREATE POLICY "admin all sub_prompts"
ON public.sub_prompts FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER sub_prompts_set_updated_at
BEFORE UPDATE ON public.sub_prompts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Backfill: migrate existing prompts.content into a first sub_prompt row
INSERT INTO public.sub_prompts (prompt_id, title, content, description, ai_models, difficulty, notes, display_order)
SELECT p.id, COALESCE(p.title, 'Prompt'), COALESCE(p.content, ''), p.description, COALESCE(p.ai_models, '{}'), p.difficulty, p.notes, 0
FROM public.prompts p
WHERE NOT EXISTS (SELECT 1 FROM public.sub_prompts s WHERE s.prompt_id = p.id);