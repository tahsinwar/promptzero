import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { Lock } from "lucide-react";
import { motion } from "framer-motion";
import { PromptCard, type PromptListItem } from "@/components/prompt-card";

export const Route = createFileRoute("/browse")({
  component: Browse,
  head: () => ({ meta: [{ title: "Browse Prompts — Prompt Vault" }, { name: "description", content: "Browse all curated AI prompts." }] }),
});

function Browse() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [showLocked, setShowLocked] = useState(false);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  const { data: prompts } = useQuery({
    queryKey: ["all-prompts"],
    queryFn: async () => (await supabase.from("prompts").select("id,title,slug,description,content,view_count,copy_count,difficulty,ai_models,is_featured,is_locked,rating_avg,pin_hash,category_id,categories(name,color)").eq("is_published", true).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: settingsData } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("settings").eq("id", 1).maybeSingle();
      return (data?.settings ?? {}) as { default_pin?: string };
    },
  });
  const defaultPin = settingsData?.default_pin || "00000";

  const filtered = useMemo(() => {
    if (!prompts) return [];
    return prompts.filter((p: any) => {
      const locked = !!p.is_locked || !!p.pin_hash;
      if (!showLocked && locked) return false;
      if (cat && p.category_id !== cat) return false;
      if (diff && p.difficulty !== diff) return false;
      if (q) {
        const s = q.toLowerCase();
        return p.title.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s);
      }
      return true;
    });
  }, [prompts, q, cat, diff, showLocked]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold">Browse the vault</h1>
        <p className="mt-2 text-muted-foreground">{prompts?.length ?? 0} prompts • search and filter to find your next favorite.</p>
      </motion.div>

      <div className="mt-8 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts…"
            className="w-full rounded-xl border border-border bg-card/60 pl-11 pr-4 py-3.5 text-sm outline-none focus:border-primary transition-colors" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={cat === null} onClick={() => setCat(null)}>All categories</Chip>
          {cats?.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} color={c.color ?? undefined}>{c.name}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["beginner", "intermediate", "advanced"] as const).map((d) => (
            <Chip key={d} active={diff === d} onClick={() => setDiff(diff === d ? null : d)}>{d}</Chip>
          ))}
          <span className="mx-1 self-center h-5 w-px bg-border" />
          <button
            onClick={() => setShowLocked((v) => !v)}
            aria-pressed={showLocked}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
              showLocked
                ? "bg-primary/15 border-primary/40 text-primary"
                : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            {showLocked ? "Showing locked" : "Hide locked"}
          </button>
        </div>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <PromptCard p={p as unknown as PromptListItem} defaultPin={defaultPin} />
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full vault-card rounded-xl p-10 text-center text-muted-foreground">No prompts match your filters.</div>
        )}
      </div>
    </div>
  );
}

function Chip({ children, active, onClick, color }: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      style={active && color ? { backgroundColor: `${color}30`, borderColor: color, color } : undefined}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-all ${active ? "bg-primary/15 border-primary/40 text-primary" : "border-border bg-card/40 text-muted-foreground hover:text-foreground hover:border-border"}`}>
      {children}
    </button>
  );
}
