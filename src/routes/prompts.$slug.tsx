import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Eye, ThumbsUp, ThumbsDown, ArrowLeft, Youtube, Link as LinkIcon, MessageSquare, HelpCircle, Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getSessionId } from "@/lib/slug";

export const Route = createFileRoute("/prompts/$slug")({
  component: PromptDetail,
  loader: async ({ params }) => {
    const { data } = await supabase.from("prompts").select("*, categories(name,color)").eq("slug", params.slug).eq("is_published", true).maybeSingle();
    if (!data) throw notFound();
    return { prompt: data };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.prompt.title} — Prompt Vault` },
      { name: "description", content: loaderData.prompt.description ?? "AI prompt from Prompt Vault" },
      { property: "og:title", content: loaderData.prompt.title },
      { property: "og:description", content: loaderData.prompt.description ?? "" },
    ] : [],
  }),
});

function PromptDetail() {
  const { prompt } = Route.useLoaderData();
  const slug = prompt.slug;
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  // increment view count once
  useEffect(() => {
    supabase.rpc("increment_view_count", { p_slug: slug });
  }, [slug]);

  const { data: tags } = useQuery({
    queryKey: ["prompt-tags", prompt.id],
    queryFn: async () => (await supabase.from("prompt_tags").select("tags(id,name,slug)").eq("prompt_id", prompt.id)).data?.map((r: any) => r.tags) ?? [],
  });
  const { data: videos } = useQuery({
    queryKey: ["prompt-videos", prompt.id],
    queryFn: async () => (await supabase.from("prompt_videos").select("*").eq("prompt_id", prompt.id).order("display_order")).data ?? [],
  });
  const { data: links } = useQuery({
    queryKey: ["prompt-links", prompt.id],
    queryFn: async () => (await supabase.from("prompt_links").select("*").eq("prompt_id", prompt.id).order("display_order")).data ?? [],
  });
  const { data: qa } = useQuery({
    queryKey: ["prompt-qa", prompt.id],
    queryFn: async () => (await supabase.from("prompt_qa").select("*").eq("prompt_id", prompt.id).order("display_order")).data ?? [],
  });
  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ["prompt-comments", prompt.id],
    queryFn: async () => (await supabase.from("comments").select("*").eq("prompt_id", prompt.id).eq("is_approved", true).order("is_pinned", { ascending: false }).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: ratings } = useQuery({
    queryKey: ["prompt-ratings", prompt.id],
    queryFn: async () => (await supabase.from("ratings").select("value").eq("prompt_id", prompt.id)).data ?? [],
  });

  const up = ratings?.filter((r) => r.value === 1).length ?? 0;
  const down = ratings?.filter((r) => r.value === -1).length ?? 0;

  const copy = async () => {
    await navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    await supabase.rpc("increment_copy_count", { p_id: prompt.id });
    toast.success("Prompt copied to clipboard");
    qc.invalidateQueries({ queryKey: ["prompt-detail"] });
  };

  const rate = useMutation({
    mutationFn: async (value: 1 | -1) => {
      const session_id = getSessionId();
      const { error } = await supabase.from("ratings").upsert({ prompt_id: prompt.id, value, session_id }, { onConflict: "prompt_id,session_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompt-ratings", prompt.id] });
      toast.success("Thanks for the feedback!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link to="/browse" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {prompt.categories && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-md" style={{ backgroundColor: `${prompt.categories.color}20`, color: prompt.categories.color }}>
              {prompt.categories.name}
            </span>
          )}
          {prompt.difficulty && <span className="text-xs px-2.5 py-1 rounded-md bg-secondary capitalize">{prompt.difficulty}</span>}
          {prompt.ai_models?.map((m: string) => (
            <span key={m} className="text-xs px-2.5 py-1 rounded-md bg-accent/15 text-accent">{m}</span>
          ))}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{prompt.title}</h1>
        {prompt.description && <p className="mt-4 text-lg text-muted-foreground">{prompt.description}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Eye className="h-4 w-4" />{prompt.view_count} views</span>
          <span className="inline-flex items-center gap-1.5"><Copy className="h-4 w-4" />{prompt.copy_count} copies</span>
          {tags?.map((t: any) => <span key={t.id} className="text-xs">#{t.slug}</span>)}
        </div>
      </motion.header>

      {/* Prompt content */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="vault-card mt-8 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> The prompt
          </div>
          <button onClick={copy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 shadow-glow transition-all">
            {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy prompt</>}
          </button>
        </div>
        <pre className="p-5 text-sm whitespace-pre-wrap font-mono text-foreground/90 leading-relaxed">{prompt.content}</pre>
      </motion.div>

      {prompt.notes && (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-5">
          <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Notes</div>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{prompt.notes}</p>
        </div>
      )}

      {/* Rating */}
      <div className="mt-8 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Was this helpful?</span>
        <button onClick={() => rate.mutate(1)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:border-primary/40 transition-colors">
          <ThumbsUp className="h-4 w-4" /> {up}
        </button>
        <button onClick={() => rate.mutate(-1)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:border-destructive/40 transition-colors">
          <ThumbsDown className="h-4 w-4" /> {down}
        </button>
      </div>

      {/* Videos */}
      {videos && videos.length > 0 && (
        <Section title="Videos" icon={Youtube}>
          <div className="grid gap-4 sm:grid-cols-2">
            {videos.map((v: any) => {
              const ytId = extractYouTubeId(v.youtube_url);
              return (
                <div key={v.id} className="vault-card rounded-xl overflow-hidden">
                  {ytId ? (
                    <div className="aspect-video"><iframe src={`https://www.youtube.com/embed/${ytId}`} className="h-full w-full" allowFullScreen title={v.title ?? "video"} /></div>
                  ) : <a href={v.youtube_url} className="block p-5 text-primary">{v.youtube_url}</a>}
                  {v.title && <div className="px-4 py-3 text-sm font-medium">{v.title}</div>}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Links */}
      {links && links.length > 0 && (
        <Section title="Resources" icon={LinkIcon}>
          <div className="grid gap-3 sm:grid-cols-2">
            {links.map((l: any) => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="vault-card rounded-xl p-4 group">
                <div className="text-xs uppercase text-muted-foreground tracking-wider">{l.link_type}</div>
                <div className="mt-1 font-semibold group-hover:gradient-text">{l.title}</div>
                {l.description && <p className="mt-1 text-sm text-muted-foreground">{l.description}</p>}
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Q&A */}
      {qa && qa.length > 0 && (
        <Section title="Q&A" icon={HelpCircle}>
          <div className="space-y-3">
            {qa.map((item: any) => (
              <details key={item.id} className="vault-card rounded-xl p-5 group">
                <summary className="cursor-pointer font-medium list-none flex justify-between items-center">{item.question}<span className="text-muted-foreground group-open:rotate-180 transition-transform">▾</span></summary>
                <p className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap">{item.answer}</p>
              </details>
            ))}
          </div>
        </Section>
      )}

      {/* Comments */}
      <Section title="Discussion" icon={MessageSquare}>
        <CommentForm promptId={prompt.id} onPosted={() => refetchComments()} />
        <div className="mt-6 space-y-3">
          {comments?.map((c: any) => (
            <div key={c.id} className="vault-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{c.author_name}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-foreground/85 whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
          {comments && comments.length === 0 && <p className="text-sm text-muted-foreground">Be the first to comment.</p>}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-2 text-2xl font-bold mb-5"><Icon className="h-5 w-5 text-primary" />{title}</h2>
      {children}
    </section>
  );
}

function CommentForm({ promptId, onPosted }: { promptId: string; onPosted: () => void }) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    if (name.length > 60 || content.length > 2000) { toast.error("Too long"); return; }
    setBusy(true);
    const { error } = await supabase.from("comments").insert({ prompt_id: promptId, author_name: name.trim(), content: content.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setContent("");
    toast.success("Comment submitted — pending review");
    onPosted();
  };

  return (
    <form onSubmit={submit} className="vault-card rounded-xl p-4 space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60}
        className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Share your thoughts…" rows={3} maxLength={2000}
        className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary resize-none" />
      <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
        {busy ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}
