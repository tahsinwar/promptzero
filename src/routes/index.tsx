import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Eye, Copy, ArrowRight, Flame, Zap, Brain } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({ meta: [{ title: "Prompt Vault — Best AI Prompts" }] }),
});

function Home() {
  const { data: featured } = useQuery({
    queryKey: ["featured-prompts"],
    queryFn: async () => {
      const { data } = await supabase.from("prompts").select("id,title,slug,description,view_count,copy_count,difficulty,ai_models,is_featured,categories(name,color)").eq("is_published", true).order("is_featured", { ascending: false }).order("view_count", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      const [{ count: prompts }, { count: cats }] = await Promise.all([
        supabase.from("prompts").select("*", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("categories").select("*", { count: "exact", head: true }),
      ]);
      return { prompts: prompts ?? 0, cats: cats ?? 0 };
    },
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Curated prompt library
            </span>
            <h1 className="mt-6 text-5xl sm:text-7xl font-bold tracking-tight">
              Unlock the <span className="gradient-text text-glow">vault</span><br />of perfect prompts.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Hand-picked AI prompts for ChatGPT, Claude, Gemini and more. Copy, customize, conquer.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/browse" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition-opacity">
                Browse prompts <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#featured" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-6 py-3 text-sm font-semibold hover:border-primary/40 transition-colors">
                <Flame className="h-4 w-4 text-accent" /> View featured
              </a>
            </div>
            {stats && (
              <div className="mt-16 grid grid-cols-3 gap-6 max-w-md mx-auto">
                <Stat label="Prompts" value={stats.prompts} icon={Brain} />
                <Stat label="Categories" value={stats.cats} icon={Zap} />
                <Stat label="Free" value="∞" icon={Sparkles} />
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Featured */}
      <section id="featured" className="mx-auto max-w-7xl px-6 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold">Featured prompts</h2>
            <p className="mt-1 text-muted-foreground">Most loved by the community.</p>
          </div>
          <Link to="/browse" className="text-sm text-primary hover:underline inline-flex items-center gap-1">View all <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured?.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <PromptCard p={p} />
            </motion.div>
          ))}
          {featured && featured.length === 0 && (
            <div className="col-span-full vault-card rounded-xl p-10 text-center text-muted-foreground">
              No prompts yet. <Link to="/admin" className="text-primary underline">Sign in</Link> to add the first one.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="vault-card rounded-xl px-4 py-5">
      <Icon className="mx-auto h-5 w-5 text-primary mb-2" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

export function PromptCard({ p }: { p: any }) {
  return (
    <Link to="/prompts/$slug" params={{ slug: p.slug }} className="vault-card rounded-xl p-5 block group">
      <div className="flex items-start justify-between mb-3">
        {p.categories ? (
          <span className="text-xs font-medium px-2 py-1 rounded-md" style={{ backgroundColor: `${p.categories.color}20`, color: p.categories.color }}>
            {p.categories.name}
          </span>
        ) : <span />}
        {p.is_featured && <Flame className="h-4 w-4 text-accent" />}
      </div>
      <h3 className="text-lg font-semibold group-hover:gradient-text transition-all">{p.title}</h3>
      {p.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{p.view_count ?? 0}</span>
        <span className="inline-flex items-center gap-1"><Copy className="h-3.5 w-3.5" />{p.copy_count ?? 0}</span>
        {p.difficulty && <span className="ml-auto capitalize text-primary/80">{p.difficulty}</span>}
      </div>
    </Link>
  );
}
