
-- Replace permissive "authenticated = full access" admin policies with strict admin-role checks.

-- admin_settings
DROP POLICY IF EXISTS "admin all admin_settings" ON public.admin_settings;
CREATE POLICY "admin all admin_settings" ON public.admin_settings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- categories
DROP POLICY IF EXISTS "admin all categories" ON public.categories;
CREATE POLICY "admin all categories" ON public.categories
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- tags
DROP POLICY IF EXISTS "admin all tags" ON public.tags;
CREATE POLICY "admin all tags" ON public.tags
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- prompts
DROP POLICY IF EXISTS "admin all prompts" ON public.prompts;
DROP POLICY IF EXISTS "admin read all prompts" ON public.prompts;
CREATE POLICY "admin all prompts" ON public.prompts
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin read all prompts" ON public.prompts
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- prompt_links
DROP POLICY IF EXISTS "admin all prompt_links" ON public.prompt_links;
CREATE POLICY "admin all prompt_links" ON public.prompt_links
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- prompt_qa
DROP POLICY IF EXISTS "admin all prompt_qa" ON public.prompt_qa;
CREATE POLICY "admin all prompt_qa" ON public.prompt_qa
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- prompt_tags
DROP POLICY IF EXISTS "admin all prompt_tags" ON public.prompt_tags;
CREATE POLICY "admin all prompt_tags" ON public.prompt_tags
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- prompt_versions
DROP POLICY IF EXISTS "admin all prompt_versions" ON public.prompt_versions;
CREATE POLICY "admin all prompt_versions" ON public.prompt_versions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- prompt_videos
DROP POLICY IF EXISTS "admin all prompt_videos" ON public.prompt_videos;
CREATE POLICY "admin all prompt_videos" ON public.prompt_videos
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- comments (keep public insert + public read approved; admin-only management)
DROP POLICY IF EXISTS "admin all comments" ON public.comments;
DROP POLICY IF EXISTS "admin read all comments" ON public.comments;
CREATE POLICY "admin all comments" ON public.comments
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin read all comments" ON public.comments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- visitor_questions (keep public insert + public read published; admin-only management)
DROP POLICY IF EXISTS "admin all visitor_questions" ON public.visitor_questions;
DROP POLICY IF EXISTS "admin read all visitor_questions" ON public.visitor_questions;
CREATE POLICY "admin all visitor_questions" ON public.visitor_questions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin read all visitor_questions" ON public.visitor_questions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ratings (keep public insert/update-own/read; admin-only delete & overrides)
DROP POLICY IF EXISTS "admin all ratings" ON public.ratings;
CREATE POLICY "admin all ratings" ON public.ratings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
