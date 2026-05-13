import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  Bookmark, Share2, Copy, Check, ThumbsUp, ThumbsDown, Printer,
  Eye, Sparkles, ChevronDown, MessageSquare, Youtube, FileText,
  Github, Twitter, Linkedin, Globe, HardDrive, ExternalLink, Clock, Info, X,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/slug";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { PinLockModal, isUnlocked } from "@/components/pin-lock-modal";
import { ShareModal } from "@/components/share-modal";
import { sanitizeBasicHtml } from "@/lib/sanitize-html";

export const Route = createFileRoute("/p/$slug")({
  component: PromptDetail,
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Prompt Vault` }] }),
});

const linkIcon = (t: string) => {
  const m: Record<string, any> = {
    drive: HardDrive, youtube: Youtube, github: Github, notion: FileText,
    pdf: FileText, twitter: Twitter, linkedin: Linkedin, website: Globe,
  };
  return m[t] ?? Globe;
};

const ytEmbed = (url: string) => {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
};

const timeAgo = (d: string) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const TABS = ["Prompt", "Notes", "Videos", "Links", "Q&A", "Comments"] as const;
type Tab = typeof TABS[number];

function PromptDetail() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const { has, toggle } = useBookmarks();
  const [tab, setTab] = useState<Tab>("Prompt");
  const [shareOpen, setShareOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["prompt-full", slug],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Single RPC: prompt + nested rels + comments + visitor Qs + version count + ratings
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

  const { data: settings } = useQuery({
    queryKey: ["admin-settings-pin"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("settings").eq("id", 1).maybeSingle();
      return (data?.settings ?? {}) as any;
    },
  });

  const prompt = data?.prompt;
  const expired = prompt?.expires_at ? new Date(prompt.expires_at).getTime() < Date.now() : false;

  // increment view once per session per slug
  useEffect(() => {
    if (!prompt) return;
    const key = `viewed_${slug}`;
    if (!sessionStorage.getItem(key)) {
      supabase.rpc("increment_view_count", { p_slug: slug });
      sessionStorage.setItem(key, "1");
    }
  }, [prompt, slug]);

  // unlock state
  useEffect(() => {
    if (prompt?.is_locked) {
      const u = isUnlocked(prompt.id);
      setUnlocked(u);
      setPinModalOpen(!u);
    } else {
      setUnlocked(true);
      setPinModalOpen(false);
    }
  }, [prompt]);

  // SEO: dynamic title & description from loaded data
  useEffect(() => {
    if (!prompt || typeof document === "undefined") return;
    document.title = `${prompt.title} — Prompt Vault`;
    const desc = (prompt.description ?? prompt.content ?? "").slice(0, 160);
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, [prompt]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <div className="h-5 w-24 rounded bg-muted/60 animate-pulse" />
            <div className="h-9 w-3/4 rounded bg-muted/60 animate-pulse" />
            <div className="h-4 w-full rounded bg-muted/40 animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-muted/40 animate-pulse" />
            <div className="vault-card rounded-2xl p-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-3 rounded bg-muted/40 animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="vault-card rounded-2xl p-4 h-32 animate-pulse" />
            <div className="vault-card rounded-2xl p-4 h-40 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }
  if (error || !data || !prompt) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">This prompt doesn't exist or was removed.</p>
        <Link to="/" className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Back home</Link>
      </div>
    );
  }
  if (expired) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <div className="vault-card rounded-2xl p-8 text-center">
          <Clock className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 text-xl font-bold">This link has expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">The author set this prompt to expire and it's no longer available.</p>
          <Link to="/browse" className="mt-5 inline-block text-sm text-primary hover:underline">Browse other prompts</Link>
        </div>
      </div>
    );
  }

  const tags = (prompt.prompt_tags ?? []).map((pt: any) => pt.tags).filter(Boolean);
  const videos = prompt.prompt_videos ?? [];
  const links = prompt.prompt_links ?? [];
  const qaList = prompt.prompt_qa ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 print:py-0 print:max-w-full">
      <PinLockModal
        promptId={prompt.id}
        pinHash={prompt.pin_hash}
        fallbackPin={settings?.default_pin ?? "00000"}
        open={!!prompt.is_locked && !unlocked && pinModalOpen}
        onUnlock={() => { setUnlocked(true); setPinModalOpen(false); }}
        onClose={() => setPinModalOpen(false)}
      />
      <ShareModal open={shareOpen} url={typeof window !== "undefined" ? window.location.href : ""} title={prompt.title} onClose={() => setShareOpen(false)} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {/* Header */}
          <header className="print:block">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {prompt.categories && (
                <span className="px-2.5 py-1 rounded-md font-medium" style={{ backgroundColor: `${prompt.categories.color}20`, color: prompt.categories.color }}>
                  {prompt.categories.name}
                </span>
              )}
              {(prompt.ai_models ?? []).map((m: string) => (
                <span key={m} className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground">{m}</span>
              ))}
              {prompt.difficulty && <span className="px-2 py-1 rounded-md border border-border">{prompt.difficulty}</span>}
              <span className="px-2 py-1 rounded-md bg-primary/15 text-primary">v{data.versionCount}</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">{prompt.title}</h1>
            {prompt.description && (
              <div
                className="mt-2 text-muted-foreground prompt-rich"
                dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(prompt.description) }}
              />
            )}

            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground print:hidden">
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {prompt.view_count} views</span>
              <span className="inline-flex items-center gap-1"><Copy className="h-3.5 w-3.5" /> {prompt.copy_count} copies</span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => toggle(slug)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border ${has(slug) ? "bg-primary/15 border-primary/40 text-primary" : "border-border hover:bg-secondary"}`}>
                  <Bookmark className="h-4 w-4" fill={has(slug) ? "currentColor" : "none"} />
                  {has(slug) ? "Saved" : "Save"}
                </button>
                <button onClick={() => setShareOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary">
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>
            </div>
          </header>

          {/* Locked state — replaces tabs/content until unlocked */}
          {prompt.is_locked && !unlocked ? (
            <LockedPromptState onUnlockClick={() => setPinModalOpen(true)} />
          ) : (
          <>
          <div className="mt-6 print:hidden">
            <div className="flex gap-1 border-b border-border overflow-x-auto">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3.5 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 print:mt-2">
            <div className={tab === "Prompt" ? "" : "hidden print:block"}>
              <PromptTab prompt={prompt} unlocked={unlocked} />
            </div>
            {tab === "Notes" && <NotesTab notes={prompt.notes} />}
            {tab === "Videos" && <VideosTab videos={videos} />}
            {tab === "Links" && <LinksTab links={links} />}
            {tab === "Q&A" && <QATab promptId={prompt.id} qa={qaList} visitorQs={data.visitorQs} onSubmitted={() => qc.invalidateQueries({ queryKey: ["prompt-full", slug] })} />}
            {tab === "Comments" && <CommentsTab promptId={prompt.id} comments={data.comments} autoApprove={!!settings?.comment_auto_approve} onSubmitted={() => qc.invalidateQueries({ queryKey: ["prompt-full", slug] })} />}
          </div>
          </>
          )}
        </div>

        {/* Sidebar */}
        <Sidebar prompt={prompt} ratings={data.ratings} tags={tags} slug={slug} />
      </div>

      <style>{`
        @media print {
          nav, footer, .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function LockedPromptState({ onUnlockClick }: { onUnlockClick: () => void }) {
  return (
    <div className="mt-8 print:hidden">
      <div className="vault-card rounded-2xl p-8 sm:p-10 border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card text-center relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <div className="relative">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30 shadow-glow">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mt-5 text-2xl sm:text-3xl font-bold tracking-tight">This prompt is locked</h2>
          <p className="mx-auto mt-3 max-w-md text-sm sm:text-base text-muted-foreground">
            The author protected this prompt with a 5-digit PIN. Enter the PIN to reveal the full prompt, sub-prompts, notes, videos, links and Q&amp;A.
          </p>

          <button
            onClick={onUnlockClick}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm sm:text-base font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition-opacity"
          >
            <Lock className="h-4 w-4" /> Enter PIN to unlock
          </button>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 max-w-2xl mx-auto text-left">
            <LockedFeature icon={Sparkles} title="Full prompt" desc="Reveal the complete prompt with all variables." />
            <LockedFeature icon={Copy} title="One-click copy" desc="Copy ready-to-use text into your AI tool." />
            <LockedFeature icon={FileText} title="Notes & resources" desc="See guidance, links and example videos." />
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Don't have the PIN? Contact the person who shared this link with you.
          </p>
        </div>
      </div>
    </div>
  );
}

function LockedFeature({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <Icon className="h-4 w-4 text-primary mb-2" />
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}

/* ---------- Prompt Tab ---------- */
function PromptTab({ prompt, unlocked }: { prompt: any; unlocked: boolean }) {
  const subs: any[] = useMemo(() => {
    const list = (prompt.sub_prompts ?? []).slice().sort((a: any, b: any) => {
      // Primary: display_order (defaults to 0 if missing)
      const d = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (d !== 0) return d;
      // Safe fallback: created_at may be absent — use empty string, then id, for determinism
      const c = String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
      if (c !== 0) return c;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
    if (list.length > 0) return list;
    // Fallback: legacy single content
    return [{
      id: prompt.id, title: prompt.title, content: prompt.content,
      description: prompt.description, ai_models: prompt.ai_models,
      difficulty: prompt.difficulty, notes: prompt.notes,
      copy_count: prompt.copy_count,
    }];
  }, [prompt]);

  const [infoFor, setInfoFor] = useState<any | null>(null);

  return (
    <div className="space-y-5">
      {subs.map((s, idx) => (
        <SubPromptCard key={s.id ?? idx} sub={s} index={idx} total={subs.length} unlocked={unlocked} promptId={prompt.id} onInfo={() => setInfoFor(s)} />
      ))}

      {(prompt.ai_models ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Compatible with:</span>
          {prompt.ai_models.map((m: string) => (
            <span key={m} className="text-xs px-2 py-0.5 rounded bg-accent/15 text-accent">{m}</span>
          ))}
        </div>
      )}

      <SubPromptInfoModal sub={infoFor} onClose={() => setInfoFor(null)} />
    </div>
  );
}

function SubPromptCard({ sub, index, total, unlocked, promptId, onInfo }: { sub: any; index: number; total: number; unlocked: boolean; promptId: string; onInfo: () => void }) {
  const [copied, setCopied] = useState(false);
  const content: string = sub.content ?? "";
  const variables = useMemo(() => {
    const set = new Set<string>();
    const re = /\[([a-zA-Z0-9_\- ]+)\]/g;
    let m;
    while ((m = re.exec(content)) !== null) set.add(m[1]);
    return Array.from(set);
  }, [content]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const tokens = Math.ceil(content.length / 4);
  const fillAllowed = sub.fill_in_enabled !== false;
  const [fillEnabled, setFillEnabled] = useState(true);
  const showFillToggle = fillAllowed && variables.length > 0 && unlocked;
  const showFillPanel = showFillToggle && fillEnabled;

  const buildContent = () => {
    let c = content;
    for (const v of variables) if (vals[v]) c = c.replaceAll(`[${v}]`, vals[v]);
    return c;
  };

  const copy = async (custom = false) => {
    if (!unlocked) { toast.error("Unlock the prompt first"); return; }
    await navigator.clipboard.writeText(custom ? buildContent() : content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    if (sub.id && sub.id !== promptId) {
      await supabase.rpc("increment_sub_prompt_copy_count" as any, { s_id: sub.id } as any);
    } else {
      await supabase.rpc("increment_copy_count", { p_id: promptId });
    }
    toast.success("Copied to clipboard");
  };

  return (
    <div className="vault-card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 gap-3">
        <div className="min-w-0 flex items-center gap-2">
          {total > 1 && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">
              {index + 1}/{total}
            </span>
          )}
          <h4 className="text-sm font-semibold truncate">{sub.title || `Prompt ${index + 1}`}</h4>
          <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">· ~{tokens} tok</span>
          {typeof sub.copy_count === "number" && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              · <Copy className="h-3 w-3" /> {sub.copy_count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {showFillToggle && (
            <button
              onClick={() => setFillEnabled((v) => !v)}
              aria-pressed={fillEnabled}
              title={fillEnabled ? "Hide Fill in your values" : "Show Fill in your values"}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                fillEnabled
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3 w-3" />
              Fill-in: {fillEnabled ? "On" : "Off"}
            </button>
          )}
          <button
            onClick={onInfo}
            aria-label="View info"
            title="Info"
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            <Info className="h-4 w-4" />
          </button>
          <button onClick={() => copy(false)} disabled={!unlocked} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            <AnimatePresence mode="wait">
              {copied ? <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Copied</motion.span>
                : <motion.span key="i" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="inline-flex items-center gap-1"><Copy className="h-3.5 w-3.5" /> Copy</motion.span>}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {showFillPanel && (
        <div className="border-b border-border bg-background/30 px-4 py-3">
          <div className="text-xs font-semibold inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Fill in your values</div>
          <div className="mt-2 grid sm:grid-cols-2 gap-2">
            {variables.map((v) => (
              <div key={v}>
                <label className="text-[10px] text-muted-foreground">[{v}]</label>
                <input value={vals[v] ?? ""} onChange={(e) => setVals({ ...vals, [v]: e.target.value })}
                  className="mt-0.5 w-full rounded-md border border-border bg-input/40 px-2 py-1 text-sm outline-none focus:border-primary" />
              </div>
            ))}
          </div>
          <button onClick={() => copy(true)} className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            Copy with my values
          </button>
        </div>
      )}

      <pre className="px-4 py-4 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
        {unlocked ? content : "🔒 Content locked — enter PIN to view"}
      </pre>
    </div>
  );
}

function SubPromptInfoModal({ sub, onClose }: { sub: any | null; onClose: () => void }) {
  if (!sub) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm px-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="vault-card rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sub-prompt info</div>
            <h3 className="mt-0.5 text-lg font-bold truncate">{sub.title || "Prompt"}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          {sub.description ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Description</div>
              <p>{sub.description}</p>
            </div>
          ) : null}

          {sub.difficulty ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Difficulty</div>
              <span className="inline-block rounded-md border border-border px-2 py-0.5 text-xs capitalize">{sub.difficulty}</span>
            </div>
          ) : null}

          {(sub.ai_models ?? []).length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">AI models</div>
              <div className="flex flex-wrap gap-1.5">
                {sub.ai_models.map((m: string) => (
                  <span key={m} className="text-xs px-2 py-0.5 rounded bg-accent/15 text-accent">{m}</span>
                ))}
              </div>
            </div>
          )}

          {sub.notes ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
              <div className="prose prose-invert max-w-none text-sm prose-a:text-primary">
                <ReactMarkdown>{sub.notes}</ReactMarkdown>
              </div>
            </div>
          ) : null}

          {!sub.description && !sub.difficulty && !(sub.ai_models ?? []).length && !sub.notes && (
            <p className="text-muted-foreground">No additional info added for this sub-prompt yet.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- Notes ---------- */
function NotesTab({ notes }: { notes: string | null }) {
  if (!notes) return <p className="text-sm text-muted-foreground">No notes added.</p>;
  return (
    <div className="vault-card rounded-xl p-5 prose prose-invert max-w-none prose-headings:font-bold prose-a:text-primary text-sm">
      <ReactMarkdown>{notes}</ReactMarkdown>
    </div>
  );
}

/* ---------- Videos ---------- */
function VideosTab({ videos }: { videos: any[] }) {
  if (videos.length === 0) return <p className="text-sm text-muted-foreground">No videos added.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {videos.map((v) => (
        <div key={v.id} className="vault-card rounded-xl overflow-hidden">
          <div className="aspect-video bg-black">
            <iframe src={ytEmbed(v.youtube_url)} title={v.title ?? "Video"} className="h-full w-full" allow="encrypted-media" allowFullScreen />
          </div>
          {v.title && <div className="p-3 text-sm font-medium">{v.title}</div>}
        </div>
      ))}
    </div>
  );
}

/* ---------- Links ---------- */
function LinksTab({ links }: { links: any[] }) {
  if (links.length === 0) return <p className="text-sm text-muted-foreground">No links added.</p>;
  const onClick = (id: string) => { supabase.rpc("increment_link_clicks" as any, { l_id: id } as any); };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {links.map((l) => {
        const Icon = linkIcon(l.link_type ?? "website");
        return (
          <a key={l.id} href={l.url} target="_blank" rel="noreferrer" onClick={() => onClick(l.id)}
            className="vault-card rounded-xl p-4 flex gap-3 hover:border-primary/40 transition-colors">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30 shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{l.title}</div>
              {l.description && <div className="text-xs text-muted-foreground line-clamp-2">{l.description}</div>}
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </a>
        );
      })}
    </div>
  );
}

/* ---------- Q&A ---------- */
function Accordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="vault-card rounded-xl">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
        <span className="text-sm font-medium">{q}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-wrap">{a}</div>}
    </div>
  );
}

function QATab({ promptId, qa, visitorQs, onSubmitted }: { promptId: string; qa: any[]; visitorQs: any[]; onSubmitted: () => void }) {
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !question.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("visitor_questions").insert({ prompt_id: promptId, author_name: name.trim().slice(0, 100), question: question.trim().slice(0, 1000) });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setDone(true); setName(""); setQuestion("");
    toast.success("Question submitted");
    onSubmitted();
  };

  return (
    <div className="space-y-6">
      {qa.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">FAQ</h3>
          <div className="space-y-2">{qa.map((x) => <Accordion key={x.id} q={x.question} a={x.answer} />)}</div>
        </section>
      )}
      {visitorQs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">Visitor questions</h3>
          <div className="space-y-2">{visitorQs.map((x) => <Accordion key={x.id} q={`${x.author_name}: ${x.question}`} a={x.answer ?? "Awaiting reply…"} />)}</div>
        </section>
      )}
      <section className="vault-card rounded-xl p-4">
        <h3 className="text-sm font-semibold">Ask a question</h3>
        {done ? <p className="mt-2 text-sm text-primary">Thanks! Your question was submitted.</p> : (
          <form onSubmit={submit} className="mt-3 space-y-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Your name" required
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} placeholder="Your question…" required rows={3}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
            <button disabled={submitting} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit question"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

/* ---------- Comments ---------- */
function CommentsTab({ promptId, comments, autoApprove, onSubmitted }: { promptId: string; comments: any[]; autoApprove: boolean; onSubmitted: () => void }) {
  const top = comments.filter((c) => !c.parent_id);
  const replies = (id: string) => comments.filter((c) => c.parent_id === id);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    const { error } = await supabase.from("comments").insert({
      prompt_id: promptId, author_name: name.trim().slice(0, 100),
      content: content.trim().slice(0, 2000), is_approved: autoApprove,
    });
    if (error) { toast.error(error.message); return; }
    setName(""); setContent(""); setDone(true);
    toast.success(autoApprove ? "Comment posted" : "Comment pending approval");
    onSubmitted();
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {top.length === 0 && <p className="text-sm text-muted-foreground">Be the first to comment.</p>}
        {top.map((c) => (
          <CommentItem key={c.id} comment={c} replies={replies(c.id)} promptId={promptId} autoApprove={autoApprove} onSubmitted={onSubmitted} />
        ))}
      </div>

      <section className="vault-card rounded-xl p-4">
        <h3 className="text-sm font-semibold">Leave a comment</h3>
        {done ? <p className="mt-2 text-sm text-primary">{autoApprove ? "Comment posted." : "Comment pending approval."}</p> : (
          <form onSubmit={submit} className="mt-3 space-y-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Your name" required
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000} placeholder="Your message…" required rows={3}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Post comment</button>
          </form>
        )}
      </section>
    </div>
  );
}

function CommentItem({ comment, replies, promptId, autoApprove, onSubmitted }: { comment: any; replies: any[]; promptId: string; autoApprove: boolean; onSubmitted: () => void }) {
  const qc = useQueryClient();
  const [replyOpen, setReplyOpen] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  const upvote = async () => {
    await supabase.rpc("increment_comment_upvote", { c_id: comment.id });
    onSubmitted();
  };
  const submitReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    const { error } = await supabase.from("comments").insert({
      prompt_id: promptId, parent_id: comment.id,
      author_name: name.trim().slice(0, 100), content: content.trim().slice(0, 2000),
      is_approved: autoApprove,
    });
    if (error) { toast.error(error.message); return; }
    setName(""); setContent(""); setReplyOpen(false);
    toast.success(autoApprove ? "Reply posted" : "Reply pending approval");
    qc.invalidateQueries();
  };

  return (
    <div className="vault-card rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">{comment.author_name}</span>
          {comment.is_pinned && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">Pinned</span>}
          <span className="ml-2 text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
        </div>
        <button onClick={upvote} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ThumbsUp className="h-3.5 w-3.5" /> {comment.upvotes ?? 0}
        </button>
      </div>
      <p className="mt-2 text-sm whitespace-pre-wrap">{comment.content}</p>
      <button onClick={() => setReplyOpen(!replyOpen)} className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1">
        <MessageSquare className="h-3 w-3" /> Reply
      </button>
      {replyOpen && (
        <form onSubmit={submitReply} className="mt-3 space-y-2 pl-4 border-l border-border">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Your reply…" required rows={2}
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Post reply</button>
        </form>
      )}
      {replies.length > 0 && (
        <div className="mt-3 space-y-2 pl-4 border-l border-border">
          {replies.map((r) => (
            <div key={r.id}>
              <div className="text-xs"><span className="font-semibold">{r.author_name}</span> <span className="text-muted-foreground ml-1">{timeAgo(r.created_at)}</span></div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Sidebar ---------- */
function Sidebar({ prompt, ratings, tags, slug }: { prompt: any; ratings: any[]; tags: any[]; slug: string }) {
  const qc = useQueryClient();
  const { has, toggle } = useBookmarks();
  const up = ratings.filter((r) => r.value === 1).length;
  const down = ratings.filter((r) => r.value === -1).length;
  const total = up + down;
  const score = total > 0 ? Math.round((up / total) * 100) : null;

  const rate = useMutation({
    mutationFn: async (value: 1 | -1) => {
      const session_id = getSessionId();
      const { error } = await supabase.from("ratings").upsert({ prompt_id: prompt.id, value, session_id }, { onConflict: "prompt_id,session_id" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prompt-full", slug] }); toast.success("Thanks!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const tagIds = tags.map((t) => t.id);
  const { data: related = [] } = useQuery({
    queryKey: ["related", prompt.id, tagIds],
    enabled: tagIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("prompt_tags").select("prompts(id,slug,title,copy_count,is_published)").in("tag_id", tagIds);
      const seen = new Set<string>();
      const out: any[] = [];
      for (const r of (data ?? []) as any[]) {
        const p = r.prompts;
        if (p && p.is_published && p.id !== prompt.id && !seen.has(p.id)) {
          seen.add(p.id); out.push(p);
        }
      }
      return out.sort((a, b) => b.copy_count - a.copy_count).slice(0, 4);
    },
  });

  return (
    <aside className="space-y-4 print:hidden">
      <div className="vault-card rounded-xl p-4">
        <h4 className="text-sm font-semibold">Was this helpful?</h4>
        <div className="mt-3 flex gap-2">
          <button onClick={() => rate.mutate(1)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm hover:bg-secondary">
            <ThumbsUp className="h-4 w-4" /> {up}
          </button>
          <button onClick={() => rate.mutate(-1)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm hover:bg-secondary">
            <ThumbsDown className="h-4 w-4" /> {down}
          </button>
        </div>
        {score !== null && <div className="mt-2 text-xs text-muted-foreground text-center">{score}% positive ({total} votes)</div>}
      </div>

      <div className="vault-card rounded-xl p-4 space-y-2">
        <button onClick={() => toggle(slug)} className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm hover:bg-secondary">
          <Bookmark className="h-4 w-4" fill={has(slug) ? "currentColor" : "none"} />
          {has(slug) ? "Saved" : "Bookmark"}
        </button>
        <button onClick={() => window.print()} className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm hover:bg-secondary">
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      {tags.length > 0 && (
        <div className="vault-card rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-2">Tags</h4>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Link key={t.id} to="/browse" search={{ tag: t.slug } as any} className="text-xs px-2 py-0.5 rounded bg-secondary hover:bg-secondary/70">#{t.name}</Link>
            ))}
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div className="vault-card rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-2">Related prompts</h4>
          <ul className="space-y-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link to="/p/$slug" params={{ slug: r.slug }} className="block text-sm hover:text-primary truncate">{r.title}</Link>
                <span className="text-xs text-muted-foreground">{r.copy_count} copies</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
