import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles, Search, Bot, Image as ImageIcon, Video, Music, ChevronDown,
  Grid3x3, List, Flame, ArrowRight, BookOpen, Copy as CopyIcon, Cpu, Lock,
} from "lucide-react";
import { PromptCard, PromptRow, PromptCardSkeleton, type PromptListItem } from "@/components/prompt-card";
import { useViewMode } from "@/hooks/use-bookmarks";
import { applyPromptVisibility } from "@/lib/prompt-visibility";

const STALE = 5 * 60 * 1000;

type SortKey = "newest" | "most_copied" | "highest_rated" | "trending";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "most_copied", label: "Most Copied" },
  { key: "highest_rated", label: "Highest Rated" },
  { key: "trending", label: "Trending" },
];

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
type Difficulty = typeof DIFFICULTIES[number];

type AICategory = "Text" | "Image" | "Video" | "Audio";
const AI_TOOLS: { name: string; cat: AICategory }[] = [
  { name: "ChatGPT", cat: "Text" }, { name: "Claude", cat: "Text" },
  { name: "Gemini", cat: "Text" }, { name: "Grok", cat: "Text" },
  { name: "Perplexity", cat: "Text" }, { name: "Mistral", cat: "Text" },
  { name: "LLaMA", cat: "Text" }, { name: "GitHub Copilot", cat: "Text" },
  { name: "Notion AI", cat: "Text" }, { name: "Jasper", cat: "Text" },
  { name: "Midjourney", cat: "Image" }, { name: "Stable Diffusion", cat: "Image" },
  { name: "DALL·E", cat: "Image" }, { name: "Leonardo AI", cat: "Image" },
  { name: "Ideogram", cat: "Image" }, { name: "Adobe Firefly", cat: "Image" },
  { name: "Runway", cat: "Video" }, { name: "Sora", cat: "Video" },
  { name: "Pika", cat: "Video" }, { name: "HeyGen", cat: "Video" },
  { name: "ElevenLabs", cat: "Audio" },
];
const CAT_ICON: Record<AICategory, typeof Bot> = { Text: Bot, Image: ImageIcon, Video, Audio: Music };
const CAT_COLOR: Record<AICategory, string> = {
  Text: "oklch(0.72 0.22 295)",
  Image: "oklch(0.78 0.18 200)",
  Video: "oklch(0.70 0.20 30)",
  Audio: "oklch(0.74 0.20 145)",
};

type HomeSearch = {
  q?: string;
  ai?: string;
  cat?: string;
  diff?: Difficulty;
  sort?: SortKey;
  locked?: "1";
};

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: (s: Record<string, unknown>): HomeSearch => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    ai: typeof s.ai === "string" && s.ai ? s.ai : undefined,
    cat: typeof s.cat === "string" && s.cat ? s.cat : undefined,
    diff: DIFFICULTIES.includes(s.diff as Difficulty) ? (s.diff as Difficulty) : undefined,
    sort: SORTS.some((x) => x.key === s.sort) ? (s.sort as SortKey) : undefined,
    locked: s.locked === "1" ? "1" : undefined,
  }),
  head: () => ({ meta: [{ title: "Prompt Vault — Best AI Prompts Collection" }] }),
});

function HomePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const setParams = (patch: Partial<HomeSearch>) =>
    navigate({ to: "/", search: (prev: HomeSearch) => {
      const next: HomeSearch = { ...prev, ...patch };
      (Object.keys(next) as (keyof HomeSearch)[]).forEach((k) => { if (!next[k]) delete next[k]; });
      return next;
    }});

  const sort = search.sort ?? "newest";
  const showLocked = search.locked === "1";
  const [view, setView] = useViewMode("grid");

  // Settings (for site_name/tagline + default_pin)
  const { data: settingsData } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("settings").eq("id", 1).maybeSingle();
      return (data?.settings ?? {}) as { site_name?: string; tagline?: string; default_pin?: string };
    },
    staleTime: STALE,
  });
  const siteName = settingsData?.site_name || "Prompt Vault";
  const tagline = settingsData?.tagline || "Best AI Prompts Collection";
  const defaultPin = settingsData?.default_pin || "00000";

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_home_stats" as any);
      if (error) throw error;
      const d = (data ?? {}) as { prompts?: number; tools?: number; copies?: number };
      return { prompts: d.prompts ?? 0, tools: d.tools ?? 0, copies: d.copies ?? 0 };
    },
    staleTime: STALE,
  });

  // Categories
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name,slug,color").order("name");
      return data ?? [];
    },
    staleTime: STALE,
  });

  // Featured
  const { data: featured } = useQuery({
    queryKey: ["featured-prompts", { showLocked }],
    queryFn: async () => {
      const base = supabase
        .from("prompts")
        .select("id,slug,title,description,content,difficulty,ai_models,is_locked,is_featured,view_count,copy_count,rating_avg,pin_hash,categories(name,color)")
        .eq("is_featured", true);
      const q = applyPromptVisibility(base, { includeLocked: showLocked });
      const { data } = await q.order("view_count", { ascending: false }).limit(8);
      return (data ?? []) as unknown as PromptListItem[];
    },
    staleTime: STALE,
  });

  // All prompts (filtered + sorted)
  const { data: prompts, isLoading: loadingPrompts } = useQuery({
    queryKey: ["prompts", { q: search.q, ai: search.ai, cat: search.cat, diff: search.diff, sort, showLocked }],
    queryFn: async () => {
      let q: any = supabase
        .from("prompts")
        .select("id,slug,title,description,content,difficulty,ai_models,is_locked,is_featured,view_count,copy_count,rating_avg,pin_hash,categories(name,color)");
      q = applyPromptVisibility(q, { includeLocked: showLocked });

      if (search.q) q = q.or(`title.ilike.%${search.q}%,description.ilike.%${search.q}%`);
      if (search.cat) q = q.eq("category_id", search.cat);
      if (search.diff) q = q.eq("difficulty", search.diff);
      if (search.ai) q = q.contains("ai_models", [search.ai]);

      switch (sort) {
        case "most_copied": q = q.order("copy_count", { ascending: false }); break;
        case "highest_rated": q = q.order("rating_avg", { ascending: false }); break;
        case "trending": q = q.order("view_count", { ascending: false }); break;
        default: q = q.order("created_at", { ascending: false });
      }

      const { data, error } = await q.limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as PromptListItem[];
    },
    staleTime: STALE,
  });

  // Hero search local state mirrors URL
  const [heroQ, setHeroQ] = useState(search.q ?? "");
  useEffect(() => { setHeroQ(search.q ?? ""); }, [search.q]);
  const submitHero = (e: FormEvent) => { e.preventDefault(); setParams({ q: heroQ.trim() || undefined }); };

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> {tagline}
            </span>
            <h1 className="mt-6 text-5xl sm:text-7xl font-bold tracking-tight">
              {siteName.split(" ").slice(0, -1).join(" ") || siteName}
              {siteName.includes(" ") && <> <span className="gradient-text text-glow">{siteName.split(" ").slice(-1)[0]}</span></>}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Discover, copy and remix the best AI prompts. Curated for ChatGPT, Claude, Midjourney and more.
            </p>

            <form onSubmit={submitHero} className="mt-10 mx-auto max-w-2xl">
              <label className="relative block">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  value={heroQ}
                  onChange={(e) => setHeroQ(e.target.value)}
                  placeholder="Search prompts, tools, use cases…"
                  className="w-full rounded-2xl border border-border bg-card/70 backdrop-blur pl-14 pr-32 py-5 text-base outline-none focus:border-primary shadow-glow/40 transition-colors"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition-opacity">
                  Search
                </button>
              </label>
            </form>

            <div className="mt-12 grid grid-cols-3 gap-3 sm:gap-6 max-w-xl mx-auto">
              <Stat label="Prompts" value={stats?.prompts ?? "—"} icon={BookOpen} />
              <Stat label="AI Tools" value={stats?.tools ?? "—"} icon={Cpu} />
              <Stat label="Total Copies" value={stats?.copies ?? "—"} icon={CopyIcon} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* AI TOOLS */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Browse by AI Tool</h2>
          <p className="mt-1 text-muted-foreground">Click a tool to filter prompts below.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {AI_TOOLS.map((t) => {
            const Icon = CAT_ICON[t.cat];
            const active = search.ai === t.name;
            const color = CAT_COLOR[t.cat];
            return (
              <button
                key={t.name}
                onClick={() => setParams({ ai: active ? undefined : t.name })}
                className={`vault-card rounded-xl p-4 text-left transition-all ${active ? "ring-2 ring-primary shadow-glow" : ""}`}
                style={active ? { borderColor: color } : undefined}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ backgroundColor: `${color}22`, color }}>
                    <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ backgroundColor: `${color}1f`, color }}>
                    {t.cat}
                  </span>
                </div>
                <div className="font-semibold text-sm">{t.name}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* FEATURED */}
      {featured && featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold flex items-center gap-2"><Flame className="h-6 w-6 text-accent" /> Featured Prompts</h2>
              <p className="mt-1 text-muted-foreground">Hand-picked highlights from the vault.</p>
            </div>
          </div>
          <div className="-mx-6 px-6 overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {featured.map((p) => (
                <div key={p.id} className="w-[320px] shrink-0">
                  <PromptCard p={p} defaultPin={defaultPin} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ALL PROMPTS */}
      <section id="all" className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-3xl font-bold">All Prompts</h2>
            <p className="mt-1 text-muted-foreground">
              {search.ai && <>Filtered by <strong className="text-foreground">{search.ai}</strong>. </>}
              {prompts?.length ?? 0} result{(prompts?.length ?? 0) === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("grid")}
              aria-label="Grid view"
              className={`grid h-9 w-9 place-items-center rounded-md border ${view === "grid" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              aria-label="List view"
              className={`grid h-9 w-9 place-items-center rounded-md border ${view === "list" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="vault-card rounded-xl p-4 mb-6 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
          <label className="relative block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={heroQ}
              onChange={(e) => setHeroQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setParams({ q: heroQ.trim() || undefined }); }}
              onBlur={() => setParams({ q: heroQ.trim() || undefined })}
              placeholder="Search…"
              className="w-full rounded-lg border border-border bg-input/40 pl-10 pr-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <SelectInput
            label="Category"
            value={search.cat ?? ""}
            onChange={(v) => setParams({ cat: v || undefined })}
            options={[{ value: "", label: "All categories" }, ...(categories?.map((c) => ({ value: c.id, label: c.name })) ?? [])]}
          />
          <SelectInput
            label="Difficulty"
            value={search.diff ?? ""}
            onChange={(v) => setParams({ diff: (v as Difficulty) || undefined })}
            options={[{ value: "", label: "All levels" }, ...DIFFICULTIES.map((d) => ({ value: d, label: d }))]}
          />
          <SelectInput
            label="Sort"
            value={sort}
            onChange={(v) => setParams({ sort: v === "newest" ? undefined : (v as SortKey) })}
            options={SORTS.map((s) => ({ value: s.key, label: s.label }))}
          />
          <button
            type="button"
            onClick={() => setParams({ locked: showLocked ? undefined : "1" })}
            aria-pressed={showLocked}
            title={showLocked ? "Hide locked prompts" : "Show locked prompts"}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors whitespace-nowrap ${
              showLocked
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border bg-input/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lock className="h-4 w-4" />
            {showLocked ? "Showing locked" : "Hide locked"}
          </button>
        </div>

        {/* Results */}
        {loadingPrompts ? (
          <div className={view === "grid" ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3" : "space-y-2"}>
            {Array.from({ length: 6 }).map((_, i) => <PromptCardSkeleton key={i} />)}
          </div>
        ) : prompts && prompts.length > 0 ? (
          view === "grid" ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {prompts.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                  <PromptCard p={p} defaultPin={defaultPin} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {prompts.map((p) => <PromptRow key={p.id} p={p} defaultPin={defaultPin} />)}
            </div>
          )
        ) : (
          <div className="vault-card rounded-xl p-12 text-center">
            <Search className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">No prompts found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try adjusting your filters or clearing the search.</p>
            <button onClick={() => navigate({ to: "/", search: {} })} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm hover:border-primary/40">
              Clear filters <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="vault-card rounded-xl px-4 py-5">
      <Icon className="mx-auto h-5 w-5 text-primary mb-2" />
      <div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function SelectInput({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative block min-w-[150px]">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-border bg-input/40 pl-3 pr-9 py-2 text-sm outline-none focus:border-primary capitalize"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
    </label>
  );
}