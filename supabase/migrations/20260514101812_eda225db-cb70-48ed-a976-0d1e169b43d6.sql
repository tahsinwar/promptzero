
-- pin_attempts table
CREATE TABLE public.pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid,
  prompt_slug text,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pin_attempts_attempted_at ON public.pin_attempts(attempted_at DESC);
CREATE INDEX idx_pin_attempts_ip ON public.pin_attempts(ip_address);
CREATE INDEX idx_pin_attempts_prompt ON public.pin_attempts(prompt_id);

ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;

-- Public can insert (logging)
CREATE POLICY "anyone can insert pin attempts"
ON public.pin_attempts
FOR INSERT
TO public
WITH CHECK (
  (length(coalesce(ip_address,'')) <= 64)
  AND (length(coalesce(user_agent,'')) <= 500)
  AND (length(coalesce(prompt_slug,'')) <= 200)
);

-- Admin read/manage
CREATE POLICY "admin all pin_attempts"
ON public.pin_attempts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
