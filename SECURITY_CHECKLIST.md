# Security Checklist

Short reference for database-layer security expectations in this project.
Review before merging any migration that touches tables, policies, or
functions.

## Row-Level Security (RLS)

- **RLS must be enabled** on every table in the `public` schema. No
  exceptions — even "lookup" tables.
- **Admin writes**: every admin-managed table has a single `ALL` policy
  scoped to `authenticated` with both
  `USING (public.has_role(auth.uid(), 'admin'))` and
  `WITH CHECK (public.has_role(auth.uid(), 'admin'))`.
- **Public reads**: only allowed where the data is intentionally public
  (e.g. published prompts, approved comments, categories, tags). Use
  `USING (is_published = true)` / `USING (is_approved = true)` rather
  than `USING (true)` whenever a status column exists.
- **Public inserts**: allowed only on visitor-submission tables
  (`comments`, `visitor_questions`, `ratings`). Never on tables that
  store admin or role data.
- **Never** use `USING (true)` or `WITH CHECK (true)` on `INSERT`,
  `UPDATE`, or `DELETE` policies for authenticated tables.
- **Roles live in `user_roles`**, never on `profiles` or any user
  table. Role checks must go through the `public.has_role(uuid, app_role)`
  `SECURITY DEFINER` function to avoid recursive RLS.
- **Never reference `auth.users`** via foreign key. Mirror needed fields
  into `public.profiles` instead.

## SQL Functions

- **Every function must pin `search_path`** in its definition:
  ```sql
  CREATE OR REPLACE FUNCTION public.example()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER          -- only when needed
  SET search_path = public  -- REQUIRED, never omit
  AS $$ ... $$;
  ```
- **`SECURITY DEFINER`** only when the function genuinely needs to bypass
  RLS (e.g. counter increments, role checks). Prefer `SECURITY INVOKER`
  by default.
- **No mutable search_path**: leaving `search_path` unset is a hard
  failure in the Supabase linter (`0011_function_search_path_mutable`)
  and must be fixed in the same migration that introduces the function.
- **Triggers**: trigger functions need `SET search_path = public` too.
- **Validation logic** belongs in triggers, not `CHECK` constraints,
  because Postgres requires `CHECK` to be immutable.

## Migrations

- All schema and policy changes ship via timestamped files in
  `supabase/migrations/`. Never edit existing migration files.
- After every migration, run the Supabase linter and resolve any new
  `WARN`/`ERROR` rows introduced by the change before moving on.
- Reserved schemas (`auth`, `storage`, `realtime`, `supabase_functions`,
  `vault`) are off-limits — no triggers, no policy edits, no DDL.

## Application Layer

- Browser code uses `@/integrations/supabase/client` (publishable key,
  RLS applies).
- Authenticated server functions use `requireSupabaseAuth` middleware.
- `supabaseAdmin` (service role) is server-only and used only for
  trusted maintenance/admin paths. Never imported from components or
  loaders.