ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
UPDATE public.prompts SET status = CASE WHEN is_published THEN 'published' ELSE 'draft' END WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS idx_prompts_status ON public.prompts(status);