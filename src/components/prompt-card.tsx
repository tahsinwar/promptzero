import { Link } from "@tanstack/react-router";
import { Bookmark, Copy, Check, Lock, Star, Eye, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PinModal } from "./pin-modal";
import { useQueryClient } from "@tanstack/react-query";
import { useCopyCount, useBumpCopyCount } from "@/hooks/use-copy-counts";

export type PromptListItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string;
  difficulty: string | null;
  ai_models: string[] | null;
  is_locked: boolean | null;
  is_featured: boolean | null;
  view_count: number | null;
  copy_count: number | null;
  rating_avg: number | null;
  pin_hash: string | null;
  categories: { name: string; color: string | null } | null;
};

async function copyPrompt(p: PromptListItem) {
  await navigator.clipboard.writeText(p.content);
  await supabase.rpc("increment_copy_count", { p_id: p.id });
}

function LiveCount({ id, fallback, className }: { id: string; fallback: number; className?: string }) {
  const value = useCopyCount(id, fallback);
  return (
    <span className={`relative inline-block tabular-nums ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 6, opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// Warm the react-query cache with the detail RPC on hover/focus so the
// /p/$slug route renders instantly when the user finally clicks.
function usePrefetchPromptDetail() {
  const qc = useQueryClient();
  return (slug: string) =>
    qc.prefetchQuery({
      queryKey: ["prompt-full", slug],
      staleTime: 5 * 60 * 1000,
      queryFn: async () => {
        const { data: payload, error } = await supabase.rpc(
          "get_prompt_detail" as any,
          { p_slug: slug } as any,
        );
        if (error) throw error;
        if (!payload) return null;
        const d = payload as any;
        return {
          prompt: d.prompt,
          comments: d.comments ?? [],
          visitorQs: d.visitorQs ?? [],
          versionCount: d.versionCount ?? 1,
          ratings: d.ratings ?? [],
        };
      },
    });
}

function BookmarkBtn({ slug, onClick }: { slug: string; onClick?: (e: React.MouseEvent) => void }) {
  const { has, toggle } = useBookmarks();
  const active = has(slug);
  return (
    <button
      aria-label={active ? "Remove bookmark" : "Save"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(slug); onClick?.(e); }}
      className={`grid h-8 w-8 place-items-center rounded-md transition-colors ${active ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
    >
      <Bookmark className={`h-4 w-4 ${active ? "fill-current" : ""}`} />
    </button>
  );
}

function CopyBtn({ p, defaultPin, compact }: { p: PromptListItem; defaultPin: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const bump = useBumpCopyCount();

  const doCopy = async () => {
    try {
      bump(p.id);
      await copyPrompt(p);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy");
    }
  };

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (p.is_locked) setPinOpen(true);
    else void doCopy();
  };

  return (
    <>
      <button
        onClick={onClick}
        aria-label={p.is_locked ? "Unlock and copy" : "Copy prompt"}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors ${
          compact
            ? "h-8 px-3 text-xs border border-border bg-card/60 hover:border-primary/40 text-muted-foreground hover:text-foreground"
            : "h-9 px-3.5 text-sm bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/25"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4" /> Copied
            </motion.span>
          ) : (
            <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5">
              <Copy className="h-4 w-4" /> Copy
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <PinModal
        open={pinOpen}
        expectedPin={p.pin_hash || defaultPin}
        onClose={() => setPinOpen(false)}
        onUnlock={() => { setPinOpen(false); void doCopy(); }}
      />
    </>
  );
}

export function PromptCard({ p, defaultPin }: { p: PromptListItem; defaultPin: string }) {
  const cat = p.categories;
  const catColor = cat?.color ?? undefined;
  const prefetch = usePrefetchPromptDetail();
  const warm = () => prefetch(p.slug);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className="h-full"
    >
    <Link
      to="/p/$slug"
      params={{ slug: p.slug }}
      onMouseEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
      className="vault-card rounded-xl p-5 block group relative h-full flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {cat && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={catColor ? { backgroundColor: `${catColor}22`, color: catColor } : undefined}>
              {cat.name}
            </span>
          )}
          {p.is_featured && <Flame className="h-3.5 w-3.5 text-accent" aria-label="Featured" />}
          {p.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Locked" />}
        </div>
        <BookmarkBtn slug={p.slug} />
      </div>

      <h3 className="text-lg font-semibold leading-snug group-hover:gradient-text transition-all line-clamp-2">{p.title}</h3>
      {p.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{p.description}</p>}

      {!!p.ai_models?.length && (
        <div className="mt-3 flex flex-wrap gap-1">
          {p.ai_models.slice(0, 3).map((m) => (
            <span key={m} className="text-[10px] font-medium rounded border border-border bg-card/60 px-1.5 py-0.5 text-muted-foreground">{m}</span>
          ))}
          {p.ai_models.length > 3 && <span className="text-[10px] text-muted-foreground">+{p.ai_models.length - 3}</span>}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{p.view_count ?? 0}</span>
        <span className="inline-flex items-center gap-1"><Copy className="h-3.5 w-3.5" /><LiveCount id={p.id} fallback={p.copy_count ?? 0} /></span>
        {!!(p.rating_avg && Number(p.rating_avg) > 0) && (
          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-current text-accent" />{Number(p.rating_avg).toFixed(1)}</span>
        )}
        <span className="ml-auto" onClick={(e) => e.preventDefault()}>
          <CopyBtn p={p} defaultPin={defaultPin} compact />
        </span>
      </div>
    </Link>
    </motion.div>
  );
}

export function PromptRow({ p, defaultPin }: { p: PromptListItem; defaultPin: string }) {
  const cat = p.categories;
  const catColor = cat?.color ?? undefined;
  const prefetch = usePrefetchPromptDetail();
  const warm = () => prefetch(p.slug);
  return (
    <Link
      to="/p/$slug"
      params={{ slug: p.slug }}
      onMouseEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
      className="vault-card rounded-lg px-4 py-3 flex items-center gap-3 group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{p.title}</h3>
          {p.is_locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
          {p.is_featured && <Flame className="h-3 w-3 text-accent shrink-0" />}
        </div>
        {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
      </div>
      {cat && (
        <span className="hidden md:inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0"
          style={catColor ? { backgroundColor: `${catColor}22`, color: catColor } : undefined}>
          {cat.name}
        </span>
      )}
      <div className="hidden lg:flex flex-wrap gap-1 max-w-[180px]">
        {p.ai_models?.slice(0, 2).map((m) => (
          <span key={m} className="text-[10px] rounded border border-border bg-card/60 px-1.5 py-0.5 text-muted-foreground">{m}</span>
        ))}
      </div>
      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        <Copy className="h-3.5 w-3.5" /><LiveCount id={p.id} fallback={p.copy_count ?? 0} />
      </span>
      <CopyBtn p={p} defaultPin={defaultPin} compact />
      <BookmarkBtn slug={p.slug} />
    </Link>
  );
}

export function PromptCardSkeleton() {
  return (
    <div className="vault-card rounded-xl p-5 animate-pulse">
      <div className="h-4 w-20 rounded bg-muted/60 mb-3" />
      <div className="h-5 w-3/4 rounded bg-muted/60" />
      <div className="mt-2 h-4 w-full rounded bg-muted/40" />
      <div className="mt-1.5 h-4 w-2/3 rounded bg-muted/40" />
      <div className="mt-4 flex gap-2">
        <div className="h-3 w-10 rounded bg-muted/60" />
        <div className="h-3 w-10 rounded bg-muted/60" />
      </div>
    </div>
  );
}