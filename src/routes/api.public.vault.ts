import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { applyPromptVisibility, PUBLIC_PROMPT_COLUMNS } from "@/lib/prompt-visibility";

const PUBLIC_SUPABASE_URL = "https://nveqnzglpbnqjsmislvi.supabase.co";
const PUBLIC_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52ZXFuemdscGJucWpzbWlzbHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNzc0NjMsImV4cCI6MjA5Mzk1MzQ2M30.j2YrIyCp0NxsJaIRtes_MJ0qppAR-EoLXt9ksfLXhVo";

type SortKey = "newest" | "most_copied" | "highest_rated" | "trending";

const promptColumns = PUBLIC_PROMPT_COLUMNS;

function getPublicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL || PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY || PUBLIC_SUPABASE_KEY,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { "cache-control": "public, max-age=30", ...(init?.headers ?? {}) },
  });
}

function applyPromptFilters(query: any, url: URL) {
  const q = (url.searchParams.get("q") ?? "").slice(0, 80).replace(/[%_,]/g, " ").trim();
  const ai = url.searchParams.get("ai");
  const cat = url.searchParams.get("cat");
  const diff = url.searchParams.get("diff");
  const sort = (url.searchParams.get("sort") || "newest") as SortKey;

  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (cat) query = query.eq("category_id", cat);
  if (diff) query = query.eq("difficulty", diff);
  if (ai) query = query.contains("ai_models", [ai]);

  if (sort === "most_copied") return query.order("copy_count", { ascending: false });
  if (sort === "highest_rated") return query.order("rating_avg", { ascending: false });
  if (sort === "trending") return query.order("view_count", { ascending: false });
  return query.order("created_at", { ascending: false });
}

async function getSettings(supabase: ReturnType<typeof getPublicClient>) {
  const { data } = await supabase.from("admin_settings").select("settings").eq("id", 1).maybeSingle();
  return data?.settings ?? {};
}

export const Route = createFileRoute("/api/public/vault")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const supabase = getPublicClient();
          const url = new URL(request.url);
          const mode = url.searchParams.get("mode") || "home";

          if (mode === "settings") return json(await getSettings(supabase));

          if (mode === "detail") {
            const slug = url.searchParams.get("slug") ?? "";
            const { data, error } = await supabase.rpc("get_prompt_detail", { p_slug: slug });
            if (error) throw error;
            return json(data);
          }

          if (mode === "related") {
            const promptId = url.searchParams.get("promptId");
            const tagIds = (url.searchParams.get("tagIds") ?? "").split(",").filter(Boolean).slice(0, 12);
            if (!promptId || tagIds.length === 0) return json([]);
            const { data, error } = await supabase.from("prompt_tags").select("prompts(id,slug,title,copy_count,is_published)").in("tag_id", tagIds);
            if (error) throw error;
            const seen = new Set<string>();
            const related = ((data ?? []) as any[])
              .map((row) => row.prompts)
              .filter((p) => p?.is_published && p.id !== promptId && !seen.has(p.id) && seen.add(p.id))
              .sort((a, b) => (b.copy_count ?? 0) - (a.copy_count ?? 0))
              .slice(0, 4);
            return json(related);
          }

          const [settings, statsResult, categoriesResult, featuredResult, promptsResult] = await Promise.all([
            getSettings(supabase),
            supabase.rpc("get_home_stats"),
            supabase.from("categories").select("id,name,slug,color").order("name"),
            applyPromptVisibility(
              supabase.from("prompts").select(promptColumns).eq("is_featured", true),
            ).order("view_count", { ascending: false }).limit(8),
            applyPromptFilters(
              applyPromptVisibility(supabase.from("prompts").select(promptColumns)),
              url,
            ).limit(mode === "browse" ? 200 : 60),
          ]);

          const firstError = statsResult.error || categoriesResult.error || featuredResult.error || promptsResult.error;
          if (firstError) throw firstError;

          return json({
            settings,
            stats: statsResult.data ?? { prompts: 0, tools: 0, copies: 0 },
            categories: categoriesResult.data ?? [],
            featured: featuredResult.data ?? [],
            prompts: promptsResult.data ?? [],
          });
        } catch (error) {
          console.error("Public vault API failed", error);
          return json({ error: "Public vault API failed" }, { status: 500, headers: { "cache-control": "no-store" } });
        }
      },
      POST: async ({ request }) => {
        try {
          const supabase = getPublicClient();
          const body = (await request.json()) as { action?: string; slug?: string; id?: string };

          if (body.action === "increment_view" && body.slug) {
            await supabase.rpc("increment_view_count", { p_slug: body.slug });
          } else if (body.action === "increment_copy" && body.id) {
            await supabase.rpc("increment_copy_count", { p_id: body.id });
          } else if (body.action === "increment_sub_copy" && body.id) {
            await supabase.rpc("increment_sub_prompt_copy_count", { s_id: body.id });
          } else {
            return json({ error: "Unsupported action" }, { status: 400, headers: { "cache-control": "no-store" } });
          }

          return json({ ok: true }, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          console.error("Public vault API mutation failed", error);
          return json({ error: "Public vault API mutation failed" }, { status: 500, headers: { "cache-control": "no-store" } });
        }
      },
    },
  },
});