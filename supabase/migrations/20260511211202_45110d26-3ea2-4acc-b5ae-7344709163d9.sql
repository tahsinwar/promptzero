-- 1) Trigger-only function: no one should call it directly
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- 2) Admin RPC: keep authenticated (function self-checks role), drop anon
REVOKE ALL ON FUNCTION public.sync_sub_prompts(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_sub_prompts(uuid, jsonb) TO authenticated;

-- 3) Move pg_trgm out of public schema (clears "Extension in Public" warning)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- pg_trgm operators (%, <%, %>) are searched via search_path; make sure roles see them
ALTER ROLE anon          SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE service_role  SET search_path = public, extensions;