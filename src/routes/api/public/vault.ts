import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type SortKey = "newest" | "most_copied" | "highest_rated" | "trending";

const promptSelect = "id,slug,title,description,content,difficulty,ai_models,is_locked,is_featured,view_count,copy_count,rating_avg,pin_hash,category_id,categories(name,color)";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function getSettings() {
  const { data } = await supabaseAdmin.from("admin_settings").select("settings").eq("id", 1).maybeSingle();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  return {
    site_name: typeof settings.site_name === "string" ? settings.site_name : undefined,
    tagline: typeof settings.tagline === "string" ? settings.tagline : undefined,
    logo_url: typeof settings.logo_url === "string" ? settings.logo_url : undefined,
    default_pin: typeof settings.default_pin === "string" ? settings.default_pin : undefined,
    comment_auto_approve: settings.comment_auto_approve === true,
  };
}

async function getPromptList(params: { q?: string; ai?: string; cat?: string; diff?: string; sort?: SortKey; featuredOnly?: boolean; limit?: number }) {
  let q = supabaseAdmin.from("prompts").select(promptSelect).eq("is_published", true);

  if (params.featuredOnly) q = q.eq("is_featured", true);
  if (params.q) q = q.or(`title.ilike.%${params.q}%,description.ilike.%${params.q}%`);
  if (params.cat) q = q.eq("category_id", params.cat);
  if (params.diff) q = q.eq("difficulty", params.diff);
  if (params.ai) q = q.contains("ai_models", [params.ai]);

  switch (params.sort) {
    case "most_copied": q = q.order("copy_count", { ascending: false }); break;
    case "highest_rated": q = q.order("rating_avg", { ascending: false }); break;
    case "trending": q = q.order("view_count", { ascending: false }); break;
    default: q = q.order(params.featuredOnly ? "view_count" : "created_at", { ascending: false });
  }

  const { data, error } = await q.limit(params.limit ?? 60);
  if (error) throw error;
  return data ?? [];
}

async function getHome(request: Request) {
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") as SortKey | null;
  const [{ data: stats }, { data: categories, error: categoriesError }, settings, featured, prompts] = await Promise.all([
    supabaseAdmin.rpc("get_home_stats" as any),
    supabaseAdmin.from("categories").select("id,name,slug,color").order("name"),
    getSettings(),
    getPromptList({ featuredOnly: true, limit: 8 }),
    getPromptList({
      q: url.searchParams.get("q") || undefined,
      ai: url.searchParams.get("ai") || undefined,
      cat: url.searchParams.get("cat") || undefined,
      diff: url.searchParams.get("diff") || undefined,
      sort: sort || "newest",
      limit: 60,
    }),
  ]);

  if (categoriesError) throw categoriesError;
  const statData = (stats ?? {}) as { prompts?: number; tools?: number; copies?: number };
  return json({
    settings,
    stats: { prompts: statData.prompts ?? 0, tools: statData.tools ?? 0, copies: statData.copies ?? 0 },
    categories: categories ?? [],
    featured,
    prompts,
  });
}

async function getBrowse() {
  const [settings, { data: categories, error: categoriesError }, prompts] = await Promise.all([
    getSettings(),
    supabaseAdmin.from("categories").select("*").order("name"),
    getPromptList({ limit: 1000 }),
  ]);
  if (categoriesError) throw categoriesError;
  return json({ settings, categories: categories ?? [], prompts });
}

async function getDetail(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return json({ error: "Missing slug" }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc("get_prompt_detail" as any, { p_slug: slug } as any);
  if (error) throw error;
  if (!data) return json(null);
  const d = data as any;
  return json({
    prompt: d.prompt,
    comments: d.comments ?? [],
    visitorQs: d.visitorQs ?? [],
    versionCount: d.versionCount ?? 1,
    ratings: d.ratings ?? [],
  });
}

async function getRelated(request: Request) {
  const url = new URL(request.url);
  const promptId = z.string().uuid().parse(url.searchParams.get("promptId"));
  const tagIds = (url.searchParams.get("tagIds") ?? "").split(",").filter(Boolean).map((id) => z.string().uuid().parse(id));
  if (tagIds.length === 0) return json([]);
  const { data, error } = await supabaseAdmin.from("prompt_tags").select("prompts(id,slug,title,copy_count,is_published)").in("tag_id", tagIds);
  if (error) throw error;
  const seen = new Set<string>();
  const related: any[] = [];
  for (const row of (data ?? []) as any[]) {
    const prompt = row.prompts;
    if (prompt?.is_published && prompt.id !== promptId && !seen.has(prompt.id)) {
      seen.add(prompt.id);
      related.push(prompt);
    }
  }
  return json(related.sort((a, b) => (b.copy_count ?? 0) - (a.copy_count ?? 0)).slice(0, 4));
}

export const Route = createFileRoute("/api/public/vault")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const mode = new URL(request.url).searchParams.get("mode");
          if (mode === "home") return getHome(request);
          if (mode === "browse") return getBrowse();
          if (mode === "settings") return json(await getSettings());
          if (mode === "detail") return getDetail(request);
          if (mode === "related") return getRelated(request);
          return json({ error: "Invalid mode" }, { status: 400 });
        } catch (error) {
          console.error("[public-vault]", error);
          return json({ error: "Could not load vault data" }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const body = z.object({
          action: z.enum(["increment_view", "increment_copy", "increment_sub_copy", "increment_link", "increment_comment_upvote", "ask_question", "add_comment", "rate"]),
          slug: z.string().optional(),
          id: z.string().uuid().optional(),
          promptId: z.string().uuid().optional(),
          parentId: z.string().uuid().optional(),
          name: z.string().optional(),
          question: z.string().optional(),
          content: z.string().optional(),
          autoApprove: z.boolean().optional(),
          value: z.union([z.literal(1), z.literal(-1)]).optional(),
          sessionId: z.string().optional(),
        }).parse(await request.json());

        if (body.action === "increment_view" && body.slug) {
          await supabaseAdmin.rpc("increment_view_count", { p_slug: body.slug });
        }
        if (body.action === "increment_copy" && body.id) {
          await supabaseAdmin.rpc("increment_copy_count", { p_id: body.id });
        }
        if (body.action === "increment_sub_copy" && body.id) {
          await supabaseAdmin.rpc("increment_sub_prompt_copy_count" as any, { s_id: body.id } as any);
        }
        if (body.action === "increment_link" && body.id) {
          await supabaseAdmin.rpc("increment_link_clicks" as any, { l_id: body.id } as any);
        }
        if (body.action === "increment_comment_upvote" && body.id) {
          await supabaseAdmin.rpc("increment_comment_upvote", { c_id: body.id });
        }
        if (body.action === "ask_question" && body.promptId && body.name && body.question) {
          await supabaseAdmin.from("visitor_questions").insert({ prompt_id: body.promptId, author_name: body.name.trim().slice(0, 100), question: body.question.trim().slice(0, 1000) });
        }
        if (body.action === "add_comment" && body.promptId && body.name && body.content) {
          const settings = await getSettings();
          await supabaseAdmin.from("comments").insert({
            prompt_id: body.promptId,
            parent_id: body.parentId,
            author_name: body.name.trim().slice(0, 100),
            content: body.content.trim().slice(0, 2000),
            is_approved: settings.comment_auto_approve === true,
          });
        }
        if (body.action === "rate" && body.promptId && body.value && body.sessionId) {
          await supabaseAdmin.from("ratings").upsert({ prompt_id: body.promptId, value: body.value, session_id: body.sessionId.slice(0, 100) }, { onConflict: "prompt_id,session_id" });
        }
        return json({ ok: true });
      },
    },
  },
});