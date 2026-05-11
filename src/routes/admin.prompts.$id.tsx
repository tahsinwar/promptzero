import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slug";
import { Save, ArrowLeft, Plus, Trash2, Copy as CopyIcon, X, Loader2, Share2, Globe, EyeOff, ChevronUp, ChevronDown, Info } from "lucide-react";
import { AdminFormSkeleton } from "@/components/admin-skeletons";
import { ShareModal } from "@/components/share-modal";
import { toast } from "sonner";
import bcrypt from "bcryptjs";

export const Route = createFileRoute("/admin/prompts/$id")({ component: EditPrompt });

const AI_MODELS = [
  "ChatGPT", "Claude", "Gemini", "Grok", "Perplexity", "Mistral", "LLaMA",
  "Copilot", "Notion AI", "Jasper",
  "Midjourney", "Stable Diffusion", "DALL·E", "Leonardo AI", "Ideogram", "Firefly",
  "Runway", "Sora", "Pika", "HeyGen", "ElevenLabs",
];
const AUTO_LOCK_OPTS = [
  { v: 0, label: "Never" },
  { v: 5, label: "5 min" },
  { v: 15, label: "15 min" },
  { v: 30, label: "30 min" },
];

type Form = {
  id?: string;
  title: string; slug: string; description: string; content: string; notes: string;
  category_id: string | null;
  ai_models: string[];
  difficulty: string | null;
  status: string;
  is_published: boolean; is_featured: boolean;
  is_locked: boolean; pin_hash: string | null;
  pin_input: string; // not stored, used to hash
  auto_lock_minutes: number;
  expires_at: string | null;
};

type SubPrompt = {
  id?: string;
  title: string;
  content: string;
  description: string;
  ai_models: string[];
  difficulty: string | null;
  notes: string;
};

const emptySub = (): SubPrompt => ({
  title: "", content: "", description: "",
  ai_models: [], difficulty: null, notes: "",
});

const empty: Form = {
  title: "", slug: "", description: "", content: "", notes: "",
  category_id: null, ai_models: [], difficulty: "intermediate",
  status: "draft", is_published: false, is_featured: false,
  is_locked: false, pin_hash: null, pin_input: "",
  auto_lock_minutes: 0, expires_at: null,
};

function EditPrompt() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const nav = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<Form>(empty);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [videos, setVideos] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [qa, setQa] = useState<any[]>([]);
  const [subPrompts, setSubPrompts] = useState<SubPrompt[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"], staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });
  const { data: tags = [], refetch: refetchTags } = useQuery({
    queryKey: ["admin-tags"], staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("tags").select("*").order("name")).data ?? [],
  });

  const { data: loaded, isLoading: editLoading } = useQuery({
    queryKey: ["edit-prompt", id], enabled: !isNew,
    queryFn: async () => {
      const [p, t, v, l, q] = await Promise.all([
        supabase.from("prompts").select("*").eq("id", id).single(),
        supabase.from("prompt_tags").select("tag_id").eq("prompt_id", id),
        supabase.from("prompt_videos").select("*").eq("prompt_id", id).order("display_order"),
        supabase.from("prompt_links").select("*").eq("prompt_id", id).order("display_order"),
        supabase.from("prompt_qa").select("*").eq("prompt_id", id).order("display_order"),
      ]);
      const sub = await supabase
        .from("sub_prompts" as any)
        .select("*")
        .eq("prompt_id", id)
        .order("display_order");
      return { prompt: p.data, tagIds: t.data?.map((x: any) => x.tag_id) ?? [], videos: v.data ?? [], links: l.data ?? [], qa: q.data ?? [], subPrompts: (sub.data as any[]) ?? [] };
    },
  });

  useEffect(() => {
    if (!loaded?.prompt) return;
    const p: any = loaded.prompt;
    setForm({
      id: p.id,
      title: p.title ?? "", slug: p.slug ?? "", description: p.description ?? "",
      content: p.content ?? "", notes: p.notes ?? "",
      category_id: p.category_id, ai_models: p.ai_models ?? [],
      difficulty: p.difficulty, status: p.status ?? (p.is_published ? "published" : "draft"),
      is_published: !!p.is_published, is_featured: !!p.is_featured,
      is_locked: !!p.is_locked, pin_hash: p.pin_hash, pin_input: "",
      auto_lock_minutes: p.auto_lock_minutes ?? 0,
      expires_at: p.expires_at ? new Date(p.expires_at).toISOString().slice(0, 16) : null,
    });
    setSelectedTags(loaded.tagIds);
    setVideos(loaded.videos);
    setLinks(loaded.links);
    setQa(loaded.qa);
    setSubPrompts(
      (loaded.subPrompts ?? []).map((s: any) => ({
        id: s.id,
        title: s.title ?? "",
        content: s.content ?? "",
        description: s.description ?? "",
        ai_models: s.ai_models ?? [],
        difficulty: s.difficulty,
        notes: s.notes ?? "",
      })),
    );
  }, [loaded]);

  const updateForm = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const onTitleChange = (v: string) => {
    setForm((f) => ({ ...f, title: v, slug: (isNew && (!f.slug || f.slug === slugify(f.title))) ? slugify(v) : f.slug }));
  };

  const toggleAi = (m: string) => {
    const next = form.ai_models.includes(m) ? form.ai_models.filter((x) => x !== m) : [...form.ai_models, m];
    updateForm("ai_models", next);
  };

  const filteredTags = useMemo(() => {
    const q = tagSearch.toLowerCase().trim();
    return q ? tags.filter((t: any) => t.name.toLowerCase().includes(q)) : tags;
  }, [tags, tagSearch]);
  const exactTagExists = useMemo(() => tags.some((t: any) => t.name.toLowerCase() === tagSearch.trim().toLowerCase()), [tags, tagSearch]);

  const createTag = async () => {
    const name = tagSearch.trim();
    if (!name) return;
    const { data, error } = await supabase.from("tags").insert({ name, slug: slugify(name) }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await refetchTags();
    setSelectedTags((s) => [...s, data.id]);
    setTagSearch("");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      if (subPrompts.length === 0) throw new Error("Add at least one sub-prompt");
      if (subPrompts.some((s) => !s.content.trim())) throw new Error("Every sub-prompt needs content");
      if (form.is_locked && form.pin_input && !/^\d{5}$/.test(form.pin_input)) throw new Error("PIN must be 5 digits");

      let pin_hash = form.pin_hash;
      if (form.is_locked && form.pin_input) pin_hash = await bcrypt.hash(form.pin_input, 10);
      if (!form.is_locked) pin_hash = null;

      const payload = {
        title: form.title.trim(),
        slug: (form.slug || slugify(form.title)).trim(),
        description: form.description || null,
        content: subPrompts[0]?.content ?? "",
        notes: form.notes || null,
        category_id: form.category_id,
        ai_models: form.ai_models,
        difficulty: form.difficulty,
        status: form.status,
        is_published: form.status === "published",
        is_featured: form.is_featured,
        is_locked: form.is_locked,
        pin_hash,
        auto_lock_minutes: form.auto_lock_minutes,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };

      let pid = id;
      if (isNew) {
        const { data, error } = await supabase.from("prompts").insert(payload).select("id").single();
        if (error) throw error; pid = data.id;
      } else {
        // version snapshot
        const { data: prev } = await supabase.from("prompts").select("content").eq("id", id).single();
        if (prev?.content) {
          await supabase.from("prompt_versions").insert({ prompt_id: id, content: prev.content, change_note: "Auto snapshot before save" });
        }
        const { error } = await supabase.from("prompts").update(payload).eq("id", id);
        if (error) throw error;
      }

      // sync tags
      await supabase.from("prompt_tags").delete().eq("prompt_id", pid);
      if (selectedTags.length) {
        await supabase.from("prompt_tags").insert(selectedTags.map((tag_id) => ({ prompt_id: pid, tag_id })));
      }

      // sync sub_prompts (delete + reinsert preserves order)
      await supabase.from("sub_prompts" as any).delete().eq("prompt_id", pid);
      if (subPrompts.length) {
        const rows = subPrompts.map((s, i) => ({
          prompt_id: pid,
          title: s.title || `Prompt ${i + 1}`,
          content: s.content,
          description: s.description || null,
          ai_models: s.ai_models ?? [],
          difficulty: s.difficulty || null,
          notes: s.notes || null,
          display_order: i,
        }));
        const { error: subErr } = await supabase.from("sub_prompts" as any).insert(rows as any);
        if (subErr) throw subErr;
      }
      return pid as string;
    },
    onSuccess: (pid) => {
      qc.invalidateQueries({ queryKey: ["admin-prompts"] });
      qc.invalidateQueries({ queryKey: ["edit-prompt", pid] });
      toast.success("Saved");
      if (isNew) nav({ to: "/admin/prompts/$id", params: { id: pid } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async () => {
      if (isNew || !id) throw new Error("Save first");
      const next = form.status === "published" ? "draft" : "published";
      const { error } = await supabase
        .from("prompts")
        .update({ status: next, is_published: next === "published" })
        .eq("id", id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      setForm((f) => ({ ...f, status: next as Form["status"] }));
      qc.invalidateQueries({ queryKey: ["admin-prompts"] });
      qc.invalidateQueries({ queryKey: ["edit-prompt", id] });
      toast.success(next === "published" ? "Published" : "Unpublished");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (isNew) return;
      const { error } = await supabase.from("prompts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-prompts"] });
      toast.success("Deleted");
      nav({ to: "/admin/prompts" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      if (isNew) throw new Error("Save first");
      const newTitle = `${form.title} (Copy)`;
      const newSlug = `${slugify(newTitle)}-${Date.now().toString(36).slice(-4)}`;
      const { data, error } = await supabase.from("prompts").insert({
        title: newTitle, slug: newSlug, description: form.description, content: form.content,
        notes: form.notes, category_id: form.category_id, ai_models: form.ai_models,
        difficulty: form.difficulty, status: "draft", is_published: false, is_featured: false,
        is_locked: form.is_locked, pin_hash: form.pin_hash, auto_lock_minutes: form.auto_lock_minutes,
      }).select("id").single();
      if (error) throw error;
      if (selectedTags.length) {
        await supabase.from("prompt_tags").insert(selectedTags.map((tag_id) => ({ prompt_id: data.id, tag_id })));
      }
      // duplicate sub_prompts too
      if (subPrompts.length) {
        await supabase.from("sub_prompts" as any).insert(
          subPrompts.map((s, i) => ({
            prompt_id: data.id,
            title: s.title || `Prompt ${i + 1}`,
            content: s.content,
            description: s.description || null,
            ai_models: s.ai_models ?? [],
            difficulty: s.difficulty || null,
            notes: s.notes || null,
            display_order: i,
          })) as any,
        );
      }
      return data.id as string;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["admin-prompts"] });
      toast.success("Duplicated");
      nav({ to: "/admin/prompts/$id", params: { id: newId } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Related items helpers
  const saveRelated = async (table: string, items: any[]) => {
    if (isNew) return;
    const t = supabase.from(table as any);
    await t.delete().eq("prompt_id", id);
    if (items.length) {
      const rows = items.map((it, i) => { const { id: _, ...rest } = it; return { ...rest, prompt_id: id, display_order: i }; });
      const { error } = await supabase.from(table as any).insert(rows as any);
      if (error) toast.error(error.message);
    }
  };

  const cat = cats.find((c: any) => c.id === form.category_id);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-6">
      <div className="min-w-0">
        <Link to="/admin/prompts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to prompts
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-3xl font-bold">{isNew ? "New prompt" : "Edit prompt"}</h1>
          <div className="flex flex-wrap gap-2">
            {!isNew && (
              <button disabled={duplicate.isPending} onClick={() => duplicate.mutate()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-60">
                {duplicate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyIcon className="h-4 w-4" />} Duplicate
              </button>
            )}
            {!isNew && (
              <button
                disabled={togglePublish.isPending}
                onClick={() => togglePublish.mutate()}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60 ${
                  form.status === "published"
                    ? "border border-border hover:bg-secondary text-muted-foreground"
                    : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25"
                }`}
                title={form.status === "published" ? "Unpublish" : "Publish"}
              >
                {togglePublish.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : form.status === "published" ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                {form.status === "published" ? "Unpublish" : "Publish"}
              </button>
            )}
            {!isNew && id && (
              <button onClick={() => setShareOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary">
                <Share2 className="h-4 w-4" /> Share
              </button>
            )}
            {!isNew && (
              <button disabled={remove.isPending} onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 text-destructive px-3 py-2 text-sm hover:bg-destructive/10 disabled:opacity-60">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
            <button onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {!isNew && editLoading && !loaded ? <AdminFormSkeleton /> : (
        <div className="vault-card rounded-xl p-5 space-y-4">
          <Field label="Title" required>
            <input value={form.title} onChange={(e) => onTitleChange(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Slug">
            <input value={form.slug} onChange={(e) => updateForm("slug", e.target.value)} placeholder="auto-generated" className={`${inputCls} font-mono`} />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} rows={2} className={inputCls} />
          </Field>
          <Field label="Content" required hint="Use [variable] for placeholders e.g. [topic]">
            <textarea value={form.content} onChange={(e) => updateForm("content", e.target.value)} rows={10} className={`${inputCls} font-mono text-sm`} />
          </Field>
          <Field label="Notes (markdown)">
            <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} rows={4} className={`${inputCls} font-mono text-sm`} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Category">
              <select value={form.category_id ?? ""} onChange={(e) => updateForm("category_id", e.target.value || null)} className={inputCls}>
                <option value="">— None —</option>
                {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Difficulty">
              <select value={form.difficulty ?? ""} onChange={(e) => updateForm("difficulty", e.target.value || null)} className={inputCls}>
                <option value="">—</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} className={inputCls}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Auto-lock timer">
              <select value={form.auto_lock_minutes} onChange={(e) => updateForm("auto_lock_minutes", Number(e.target.value))} className={inputCls}>
                {AUTO_LOCK_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Expires at (optional)">
            <input type="datetime-local" value={form.expires_at ?? ""} onChange={(e) => updateForm("expires_at", e.target.value || null)} className={inputCls} />
          </Field>

          {/* AI Models */}
          <Field label="AI models">
            <div className="flex flex-wrap gap-1.5">
              {AI_MODELS.map((m) => {
                const active = form.ai_models.includes(m);
                return (
                  <button key={m} type="button" onClick={() => toggleAi(m)}
                    className={`text-xs rounded-full border px-2.5 py-1 ${active ? "bg-primary/15 border-primary/40 text-primary" : "border-border bg-card/40 text-muted-foreground hover:text-foreground"}`}>
                    {m}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Tags */}
          <Field label="Tags">
            <div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedTags.map((tid) => {
                  const t = tags.find((x: any) => x.id === tid);
                  if (!t) return null;
                  return (
                    <span key={tid} className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary text-xs px-2 py-0.5">
                      #{t.name}
                      <button onClick={() => setSelectedTags(selectedTags.filter((x) => x !== tid))}><X className="h-3 w-3" /></button>
                    </span>
                  );
                })}
              </div>
              <input value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} placeholder="Search or create tag…" className={inputCls} />
              {tagSearch && (
                <div className="mt-2 vault-card rounded-lg p-2 max-h-48 overflow-auto">
                  {filteredTags.filter((t: any) => !selectedTags.includes(t.id)).map((t: any) => (
                    <button key={t.id} type="button" onClick={() => { setSelectedTags([...selectedTags, t.id]); setTagSearch(""); }}
                      className="w-full text-left rounded px-2 py-1 text-sm hover:bg-secondary">#{t.name}</button>
                  ))}
                  {!exactTagExists && tagSearch.trim() && (
                    <button type="button" onClick={createTag} className="w-full text-left rounded px-2 py-1 text-sm text-primary hover:bg-secondary">
                      + Create "{tagSearch.trim()}"
                    </button>
                  )}
                </div>
              )}
            </div>
          </Field>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_featured} onChange={(e) => updateForm("is_featured", e.target.checked)} /> Featured</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_locked} onChange={(e) => updateForm("is_locked", e.target.checked)} /> PIN locked</label>
          </div>
          {form.is_locked && (
            <Field label={form.pin_hash ? "New 5-digit PIN (leave blank to keep)" : "5-digit PIN"}>
              <input value={form.pin_input} onChange={(e) => updateForm("pin_input", e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric" maxLength={5} placeholder="•••••" className={`${inputCls} tracking-widest`} />
            </Field>
          )}
        </div>
        )}

        <RelatedEditor title="Videos" items={videos} setItems={setVideos} disabled={isNew}
          fields={[{ key: "youtube_url", label: "YouTube URL", required: true }, { key: "title", label: "Title" }]}
          onSave={() => saveRelated("prompt_videos", videos).then(() => toast.success("Videos saved"))} />

        <RelatedEditor title="Links" items={links} setItems={setLinks} disabled={isNew}
          fields={[
            { key: "title", label: "Title", required: true },
            { key: "url", label: "URL", required: true },
            { key: "link_type", label: "Type", select: ["website", "drive", "youtube", "github", "notion", "pdf", "twitter", "linkedin"] },
            { key: "description", label: "Description" },
          ]}
          onSave={() => saveRelated("prompt_links", links).then(() => toast.success("Links saved"))} />

        <RelatedEditor title="Q&A" items={qa} setItems={setQa} disabled={isNew}
          fields={[{ key: "question", label: "Question", required: true }, { key: "answer", label: "Answer", required: true, textarea: true }]}
          onSave={() => saveRelated("prompt_qa", qa).then(() => toast.success("Q&A saved"))} />

        {confirmDelete && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm px-4" onClick={() => setConfirmDelete(false)}>
            <div className="vault-card rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold">Delete this prompt?</h3>
              <p className="mt-2 text-sm text-muted-foreground">This permanently deletes "{form.title}".</p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setConfirmDelete(false)} className="rounded-md border border-border px-3 py-1.5 text-sm">Cancel</button>
                <button disabled={remove.isPending} onClick={() => remove.mutate()} className="rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5">{remove.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live preview */}
      <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Live preview</div>
        <div className="vault-card rounded-xl p-5 max-h-[80vh] overflow-auto">
          <div className="flex flex-wrap gap-1.5 mb-2 text-xs">
            {cat && <span className="px-2 py-0.5 rounded font-medium" style={{ backgroundColor: `${cat.color ?? "#6366f1"}25`, color: cat.color ?? "#6366f1" }}>{cat.name}</span>}
            {form.ai_models.slice(0, 5).map((m) => <span key={m} className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{m}</span>)}
            {form.difficulty && <span className="px-2 py-0.5 rounded border border-border">{form.difficulty}</span>}
          </div>
          <h2 className="text-xl font-bold">{form.title || "Untitled prompt"}</h2>
          {form.description && <p className="mt-1 text-sm text-muted-foreground">{form.description}</p>}
          <pre className="mt-4 text-xs font-mono whitespace-pre-wrap break-words rounded-lg bg-secondary/40 p-3 leading-relaxed">{form.content || "Prompt content will appear here…"}</pre>
        </div>
      </aside>
      <ShareModal
        open={shareOpen}
        url={typeof window !== "undefined" && id ? `${window.location.origin}/s/${String(id).slice(0, 6)}` : ""}
        title={form.title}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}

const inputCls = "mt-1 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}{required && " *"}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function RelatedEditor({ title, items, setItems, fields, onSave, disabled }: {
  title: string; items: any[]; setItems: (v: any[]) => void;
  fields: { key: string; label: string; required?: boolean; textarea?: boolean; select?: string[] }[];
  onSave: () => void; disabled?: boolean;
}) {
  const add = () => {
    const blank: any = { id: `tmp-${Date.now()}` };
    fields.forEach((f) => (blank[f.key] = ""));
    setItems([...items, blank]);
  };
  const update = (i: number, k: string, v: string) => {
    const next = [...items]; next[i] = { ...next[i], [k]: v }; setItems(next);
  };
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  return (
    <section className="mt-6 vault-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="flex gap-2">
          <button onClick={add} disabled={disabled} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
          <button onClick={onSave} disabled={disabled} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Save {title.toLowerCase()}</button>
        </div>
      </div>
      {disabled && <p className="text-xs text-muted-foreground">Save the prompt first to add {title.toLowerCase()}.</p>}
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={item.id ?? i} className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 grid sm:grid-cols-2 gap-2">
                {fields.map((f) => f.textarea ? (
                  <textarea key={f.key} placeholder={f.label} value={item[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} rows={2}
                    className="sm:col-span-2 w-full rounded-md border border-border bg-input/40 px-2.5 py-1.5 text-sm" />
                ) : f.select ? (
                  <select key={f.key} value={item[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)}
                    className="w-full rounded-md border border-border bg-input/40 px-2.5 py-1.5 text-sm">
                    <option value="">{f.label}</option>
                    {f.select.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input key={f.key} placeholder={f.label} value={item[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)}
                    className="w-full rounded-md border border-border bg-input/40 px-2.5 py-1.5 text-sm" />
                ))}
              </div>
              <button onClick={() => remove(i)} className="grid h-8 w-8 place-items-center text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && !disabled && <p className="text-sm text-muted-foreground">None yet. Click Add to create one.</p>}
      </div>
    </section>
  );
}
