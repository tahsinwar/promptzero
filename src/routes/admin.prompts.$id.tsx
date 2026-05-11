import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slug";
import { Save, ArrowLeft, Plus, Trash2, Copy as CopyIcon, X, Loader2, Share2, Globe, EyeOff, ChevronUp, ChevronDown, Info, AlertTriangle, GripVertical, Wand2, Undo2 } from "lucide-react";
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
  // Snapshot of DB ordering fields (for admin verification only — not edited here)
  saved_display_order?: number | null;
  saved_created_at?: string | null;
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
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
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
        saved_display_order: typeof s.display_order === "number" ? s.display_order : null,
        saved_created_at: s.created_at ?? null,
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
      const badContent = subPrompts.findIndex((s) => !s.content.trim());
      if (badContent !== -1) throw new Error(`Sub-prompt #${badContent + 1}: content is required`);
      const badTitle = subPrompts.findIndex((s) => !s.title.trim());
      if (badTitle !== -1) throw new Error(`Sub-prompt #${badTitle + 1}: title is required`);
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

      // sync sub_prompts atomically via RPC (single transaction)
      const itemsPayload = subPrompts.map((s, i) => ({
        id: s.id ?? null,
        title: s.title || `Prompt ${i + 1}`,
        content: s.content,
        description: s.description || null,
        ai_models: s.ai_models ?? [],
        difficulty: s.difficulty || null,
        notes: s.notes || null,
      }));
      const { error: syncErr } = await supabase.rpc("sync_sub_prompts" as any, {
        p_id: pid,
        items: itemsPayload as any,
      });
      if (syncErr) throw syncErr;
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
      // Centralized: route duplicate inserts through the same RPC so create
      // and reorder paths share one code path. New ids (no `id` field) take
      // the INSERT branch inside sync_sub_prompts.
      if (subPrompts.length) {
        const itemsPayload = subPrompts.map((s, i) => ({
          id: null,
          title: s.title || `Prompt ${i + 1}`,
          content: s.content,
          description: s.description || null,
          ai_models: s.ai_models ?? [],
          difficulty: s.difficulty || null,
          notes: s.notes || null,
        }));
        const { error: dupErr } = await supabase.rpc("sync_sub_prompts" as any, {
          p_id: data.id,
          items: itemsPayload as any,
        });
        if (dupErr) throw dupErr;
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
          <Field label="Notes (markdown, page-level)">
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

       <SubPromptsEditor items={subPrompts} setItems={setSubPrompts} promptId={isNew ? null : id} />

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

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

function SubPromptsEditor({ items, setItems, promptId }: { items: SubPrompt[]; setItems: (v: SubPrompt[]) => void; promptId: string | null }) {
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  // Tracks focus inside any text field in the editor — used to disable Undo
  // mid-typing so a stale snapshot can't be restored.
  const [isTyping, setIsTyping] = useState(false);
  // Activity log for Auto-fix undo lifecycle. Surfaced briefly in the UI.
  const [lastUndoActivity, setLastUndoActivity] = useState<
    | { kind: "applied" | "dismissed" | "expired"; at: number }
    | null
  >(null);

  // Guard a structural mutation (add/remove/move/drag-reorder/toggle): if an
  // Auto-fix Undo snapshot is currently live, ask the admin to confirm before
  // discarding it. Returns whether the caller should proceed.
  // We use this for deliberate ops only; typing inside text fields falls
  // through to the items-change useEffect which auto-dismisses with an
  // "expired" activity note.
  const confirmDiscardUndo = (actionLabel: string): boolean => {
    if (!autoFixUndo) return true;
    const ok = window.confirm(
      `You have an active Auto-fix Undo snapshot. ${actionLabel} will discard it and you won't be able to revert the previous reorder.\n\nProceed?`,
    );
    if (!ok) return false;
    setAutoFixUndo(null);
    setLastUndoActivity({ kind: "dismissed", at: Date.now() });
    return true;
  };

  const add = () => {
    if (!confirmDiscardUndo("Adding a new sub-prompt")) return;
    setItems([...items, emptySub()]);
  };
  // Typing through a field — no confirm, but useEffect below will expire the
  // snapshot once items diverges from the post-fix reference.
  const update = (i: number, patch: Partial<SubPrompt>) => {
    const next = [...items]; next[i] = { ...next[i], ...patch }; setItems(next);
  };
  const remove = (i: number) => {
    if (!confirmDiscardUndo("Removing this sub-prompt")) return;
    setItems(items.filter((_, idx) => idx !== i));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    if (!confirmDiscardUndo("Moving this sub-prompt")) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    if (!confirmDiscardUndo("Drag-reordering sub-prompts")) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
  };
  const onDragStart = (i: number) => (e: React.DragEvent) => {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(i)); } catch {}
  };
  const onDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIdx !== i) setOverIdx(i);
  };
  const onDrop = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx !== null) reorder(dragIdx, i); // optimistic — UI updates immediately
    setDragIdx(null);
    setOverIdx(null);
  };
  const onDragEnd = () => { setDragIdx(null); setOverIdx(null); };
  const toggleModel = (i: number, m: string) => {
    if (!confirmDiscardUndo("Toggling AI models")) return;
    const cur = items[i].ai_models ?? [];
    const next = [...items];
    next[i] = {
      ...next[i],
      ai_models: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m],
    };
    setItems(next);
  };

  // Admin order-consistency check: verifies stored display_order is strictly
  // increasing and matches a created_at tiebreaker sort. Reports gaps,
  // duplicates, missing values, and current vs saved order mismatches.
  const orderReport = useMemo(() => {
    // Rendered-index map for the full items array (with unsaved rows interleaved).
    const renderIdx = new Map<string, number>();
    items.forEach((s, i) => { if (s.id) renderIdx.set(s.id, i); });

    const saved = items.filter((s) => s.id);
    const label = (s: SubPrompt, fallbackIdx: number) =>
      (s.title?.trim() || `Prompt ${fallbackIdx + 1}`);

    // Itemized: missing display_order / created_at
    const missingOrderItems = saved
      .filter((s) => s.saved_display_order == null)
      .map((s) => ({ id: s.id!, idx: renderIdx.get(s.id!) ?? -1, title: label(s, renderIdx.get(s.id!) ?? 0) }));
    const missingCreatedItems = saved
      .filter((s) => !s.saved_created_at)
      .map((s) => ({ id: s.id!, idx: renderIdx.get(s.id!) ?? -1, title: label(s, renderIdx.get(s.id!) ?? 0) }));

    // Itemized: duplicate display_order values
    const orderCounts = new Map<number, string[]>();
    saved.forEach((s) => {
      const v = s.saved_display_order;
      if (v == null) return;
      const arr = orderCounts.get(v) ?? [];
      arr.push(s.id!);
      orderCounts.set(v, arr);
    });
    const duplicateItems: { display_order: number; ids: { id: string; idx: number; title: string }[] }[] = [];
    orderCounts.forEach((ids, v) => {
      if (ids.length > 1) {
        duplicateItems.push({
          display_order: v,
          ids: ids.map((id) => {
            const s = saved.find((x) => x.id === id)!;
            const i = renderIdx.get(id) ?? -1;
            return { id, idx: i, title: label(s, i) };
          }),
        });
      }
    });

    // Itemized: gap/mismatch — saved display_order does not equal position
    //   in the (display_order, created_at, id) deterministic sort.
    const sortedBySaved = [...saved].sort((a, b) => {
      const d = (a.saved_display_order ?? 0) - (b.saved_display_order ?? 0);
      if (d !== 0) return d;
      const c = String(a.saved_created_at ?? "").localeCompare(String(b.saved_created_at ?? ""));
      if (c !== 0) return c;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
    const gapItems = sortedBySaved
      .map((s, expected) => {
        const got = s.saved_display_order ?? -1;
        if (got === expected) return null;
        const i = renderIdx.get(s.id!) ?? -1;
        return { id: s.id!, idx: i, title: label(s, i), saved: got, expected };
      })
      .filter(Boolean) as { id: string; idx: number; title: string; saved: number; expected: number }[];

    // Itemized: rendered position differs from sorted position
    const sortedIds = sortedBySaved.map((s) => s.id!);
    const renderMismatchItems = saved
      .map((s) => {
        const rendered = renderIdx.get(s.id!) ?? -1;
        // map saved-only rendered position to its index among saved rows
        const renderedAmongSaved = saved.findIndex((x) => x.id === s.id);
        const expectedAmongSaved = sortedIds.indexOf(s.id!);
        if (renderedAmongSaved === expectedAmongSaved) return null;
        return {
          id: s.id!,
          idx: rendered,
          title: label(s, rendered),
          rendered: renderedAmongSaved,
          expected: expectedAmongSaved,
        };
      })
      .filter(Boolean) as { id: string; idx: number; title: string; rendered: number; expected: number }[];

    const dupes = duplicateItems.length > 0;
    const gaps = gapItems.length;
    const renderMismatch = renderMismatchItems.length > 0;
    const missingOrder = missingOrderItems.length;
    const missingCreated = missingCreatedItems.length;
    const hasIssue = dupes || renderMismatch || gaps > 0 || missingOrder > 0;
    const unsaved = items.length - saved.length;

    return {
      hasIssue, dupes, renderMismatch, gaps, missingOrder, missingCreated,
      unsaved, total: items.length,
      duplicateItems, gapItems, renderMismatchItems, missingOrderItems, missingCreatedItems,
    };
  }, [items]);

  // Server-side mirror of the same check (via SQL function check_sub_prompt_order).
  // Useful to confirm the DB agrees with what we computed from fetched data.
  const { data: serverReport, refetch: refetchServerReport } = useQuery({
    queryKey: ["sub-prompt-order-check", promptId],
    enabled: !!promptId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_sub_prompt_order" as any, { p_id: promptId });
      if (error) throw error;
      return data as { total: number; duplicates: number; gaps_or_mismatches: number; missing_display_order: number; missing_created_at: number; consistent: boolean };
    },
  });

  const serverClientAgree = !serverReport
    ? null
    : (serverReport.consistent === !orderReport.hasIssue);

  // Field-level diff between client computed values and server report.
  const fieldDiff = useMemo(() => {
    if (!serverReport) return [] as { field: string; client: number | boolean; server: number | boolean }[];
    const rows: { field: string; client: number | boolean; server: number | boolean }[] = [
      { field: "total (persisted)", client: items.filter((s) => s.id).length, server: serverReport.total },
      { field: "gaps_or_mismatches", client: orderReport.gaps, server: serverReport.gaps_or_mismatches },
      { field: "duplicates", client: orderReport.duplicateItems.length, server: serverReport.duplicates },
      { field: "missing_display_order", client: orderReport.missingOrder, server: serverReport.missing_display_order },
      { field: "missing_created_at", client: orderReport.missingCreated, server: serverReport.missing_created_at },
      { field: "consistent", client: !orderReport.hasIssue, server: serverReport.consistent },
    ];
    return rows.filter((r) => r.client !== r.server);
  }, [serverReport, orderReport, items]);

  // Re-run server check when the persisted DB snapshot changes (after save reload).
  const dbSig = useMemo(
    () => items.filter((s) => s.id).map((s) => `${s.id}:${s.saved_display_order ?? "?"}`).join("|"),
    [items],
  );
  useEffect(() => { if (promptId) refetchServerReport(); }, [dbSig, promptId, refetchServerReport]);

  // Auto-fix: deterministically reorder items to match the server sort key
  // (saved_display_order, saved_created_at, id) and persist via the same
  // sync_sub_prompts RPC the main Save button uses. Unsaved (no-id) items are
  // appended at the end, preserving their current rendered order.
  const qc = useQueryClient();
  const [autoFixPending, setAutoFixPending] = useState(false);
  // Snapshot captured at the moment Auto-fix runs, so the admin can undo the
  // reorder if the result wasn't what they expected. Cleared on any subsequent
  // manual edit, drag, or successful undo.
  const [autoFixUndo, setAutoFixUndo] = useState<
    | {
        items: SubPrompt[];
        postFixItems: SubPrompt[];
        persisted: boolean;
        movedCount: number;
      }
    | null
  >(null);

  // Auto-dismiss the Undo banner the moment the user does anything that mutates
  // items outside of Auto-fix / Undo themselves (manual edit, drag-reorder,
  // add, remove). We detect that by comparing the current items reference to
  // the snapshot captured after the last Auto-fix ran. setItems always
  // produces a new array reference for real mutations, so a divergence here
  // means the snapshot is stale and Undo would restore the wrong state.
  useEffect(() => {
    if (!autoFixUndo) return;
    if (items !== autoFixUndo.postFixItems) {
      setAutoFixUndo(null);
    }
  }, [items, autoFixUndo]);

  // Preview of what auto-fix will change: returns the proposed order and the
  // list of items whose rendered position would move. Computed without
  // mutating state so we can show a confirmation prompt first.
  const autoFixPreview = useMemo(() => {
    const saved = items.filter((s) => s.id);
    const unsaved = items.filter((s) => !s.id);
    const sortedSaved = [...saved].sort((a, b) => {
      const d = (a.saved_display_order ?? 0) - (b.saved_display_order ?? 0);
      if (d !== 0) return d;
      const c = String(a.saved_created_at ?? "").localeCompare(String(b.saved_created_at ?? ""));
      if (c !== 0) return c;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
    const proposed = [...sortedSaved, ...unsaved];
    const moves: { title: string; from: number; to: number; isSaved: boolean }[] = [];
    proposed.forEach((s, to) => {
      const from = items.findIndex((x) => x === s);
      if (from !== to) {
        moves.push({
          title: s.title?.trim() || `Prompt ${to + 1}`,
          from,
          to,
          isSaved: !!s.id,
        });
      }
    });
    const savedMoves = moves.filter((m) => m.isSaved).length;
    const unsavedMoves = moves.length - savedMoves;
    // "Local only" = no DB writes will happen: either nothing persisted yet
    // (new prompt), or every moving row is unsaved.
    const localOnly = !promptId || savedMoves === 0;
    return {
      proposed,
      moves,
      total: items.length,
      savedCount: saved.length,
      unsavedCount: unsaved.length,
      savedMoves,
      unsavedMoves,
      localOnly,
    };
  }, [items, promptId]);

  const autoFix = useMutation({
    mutationFn: async () => {
      const prev = items;
      const next = autoFixPreview.proposed;
      const movedCount = autoFixPreview.moves.length;
      setItems(next);

      if (!promptId) {
        return { reordered: next.length, persisted: false, prev, next, movedCount };
      }

      // Same payload shape used by the parent Save mutation.
      const itemsPayload = next.map((s, i) => ({
        id: s.id ?? null,
        title: s.title || `Prompt ${i + 1}`,
        content: s.content,
        description: s.description || null,
        ai_models: s.ai_models ?? [],
        difficulty: s.difficulty || null,
        notes: s.notes || null,
      }));
      const { error } = await supabase.rpc("sync_sub_prompts" as any, {
        p_id: promptId,
        items: itemsPayload as any,
      });
      if (error) throw error;
      return { reordered: next.length, persisted: true, prev, next, movedCount };
    },
    onSuccess: (res) => {
      setAutoFixPending(false);
      setAutoFixUndo({
        items: res.prev,
        postFixItems: res.next,
        persisted: res.persisted,
        movedCount: res.movedCount,
      });
      if (res.persisted) {
        qc.invalidateQueries({ queryKey: ["edit-prompt", promptId] });
        refetchServerReport();
        toast.success(`Auto-fixed order for ${res.reordered} item${res.reordered === 1 ? "" : "s"}`);
      } else {
        toast.success("Reordered locally — save the prompt to persist");
      }
    },
    onError: (e: any) => {
      setAutoFixPending(false);
      toast.error(e.message ?? "Auto-fix failed");
    },
  });

  // Undo: restore the items array captured before the last Auto-fix. If the
  // reorder was persisted, also push the previous order through sync_sub_prompts
  // so the DB display_order reverts. created_at stays untouched in both cases.
  const undoAutoFix = useMutation({
    mutationFn: async () => {
      if (!autoFixUndo) return { persisted: false };
      const prev = autoFixUndo.items;
      setItems(prev);

      if (!autoFixUndo.persisted || !promptId) return { persisted: false };

      const itemsPayload = prev.map((s, i) => ({
        id: s.id ?? null,
        title: s.title || `Prompt ${i + 1}`,
        content: s.content,
        description: s.description || null,
        ai_models: s.ai_models ?? [],
        difficulty: s.difficulty || null,
        notes: s.notes || null,
      }));
      const { error } = await supabase.rpc("sync_sub_prompts" as any, {
        p_id: promptId,
        items: itemsPayload as any,
      });
      if (error) throw error;
      return { persisted: true };
    },
    onSuccess: (res) => {
      setAutoFixUndo(null);
      if (res.persisted) {
        qc.invalidateQueries({ queryKey: ["edit-prompt", promptId] });
        refetchServerReport();
        toast.success("Reverted to previous order");
      } else {
        toast.success("Reverted locally");
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Undo failed"),
  });


  return (
    <section className="mt-6 vault-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold">Sub-prompts</h2>
          <p className="text-xs text-muted-foreground">Add one or many prompts to this page. The info button on the public page shows description, AI models, difficulty, and notes.</p>
        </div>
        <button onClick={add} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">
          <Plus className="h-3.5 w-3.5" /> Add sub-prompt
        </button>
      </div>

      {items.length > 0 && (
        <div className={`mb-3 rounded-md border px-3 py-2 text-xs ${orderReport.hasIssue ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"}`}>
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <div className="font-semibold">
                Order check: {orderReport.hasIssue ? "needs save" : "consistent"} ({orderReport.total} item{orderReport.total === 1 ? "" : "s"}{orderReport.unsaved > 0 ? `, ${orderReport.unsaved} unsaved` : ""})
              </div>
              <ul className="text-[11px] opacity-90 list-disc pl-4">
                <li>display_order gaps/mismatches: {orderReport.gaps}</li>
                <li>duplicate display_order: {orderReport.dupes ? "yes" : "no"}</li>
                <li>missing display_order: {orderReport.missingOrder}</li>
                <li>missing created_at: {orderReport.missingCreated} (safe fallback to id applied)</li>
                <li>current order vs DB: {orderReport.renderMismatch ? "differs — save to persist" : "matches"}</li>
                {serverReport && (
                  <li>
                    server check: {serverReport.consistent ? "consistent" : "inconsistent"}
                    {" "}(gaps {serverReport.gaps_or_mismatches}, dupes {serverReport.duplicates})
                    {serverClientAgree === false && (
                      <span className="ml-1 font-semibold">— mismatch with client report!</span>
                    )}
                  </li>
                )}
              </ul>
              {(orderReport.hasIssue || serverClientAgree === false) && (
                <details className="mt-1 rounded border border-current/30 bg-background/40 text-foreground">
                  <summary className="cursor-pointer px-2 py-1 text-[11px] font-semibold text-current">
                    Breakdown — which items caused issues
                  </summary>
                  <div className="space-y-2 p-2 text-[11px] text-muted-foreground">
                    <div className="rounded border border-border bg-background/60 px-2 py-1.5">
                      {autoFixPreview.moves.length > 0 && (
                        autoFixPreview.localOnly ? (
                          <div className="mb-1.5 flex items-start gap-1.5 rounded border border-muted-foreground/30 bg-muted/40 px-2 py-1 text-[11px] text-foreground">
                            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                            <div>
                              <span className="font-semibold">Local-only reorder.</span>{" "}
                              {!promptId
                                ? <>This prompt has not been saved yet, so <code className="font-mono">sync_sub_prompts</code> won't be called. The new order lives in the editor only — press <span className="font-semibold">Save</span> at the top to persist.</>
                                : <>Only unsaved item{autoFixPreview.unsavedMoves === 1 ? "" : "s"} will move ({autoFixPreview.unsavedMoves} unsaved, 0 saved). No DB write happens now — the new order is persisted when you press <span className="font-semibold">Save</span>.</>}
                            </div>
                          </div>
                        ) : (
                          <div className="mb-1.5 flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-foreground">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                            <div>
                              <span className="font-semibold">DB write incoming.</span>{" "}
                              {autoFixPreview.savedMoves} saved row{autoFixPreview.savedMoves === 1 ? "" : "s"} will be reordered, which triggers <code className="font-mono">sync_sub_prompts</code> immediately on confirm. <code className="font-mono">created_at</code> stays untouched; only <code className="font-mono">display_order</code> changes.
                              {autoFixPreview.unsavedMoves > 0 && (
                                <> {autoFixPreview.unsavedMoves} unsaved row{autoFixPreview.unsavedMoves === 1 ? " is" : "s are"} also repositioned locally.</>
                              )}
                            </div>
                          </div>
                        )
                      )}
                      {!autoFixPending ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="space-y-0.5 text-[11px] text-muted-foreground">
                            <div>
                              Recalculate <code className="font-mono">display_order</code> from server's deterministic sort and persist via <code className="font-mono">sync_sub_prompts</code>.
                            </div>
                            {autoFixPreview.moves.length === 0 ? (
                              <div className="text-foreground">
                                Order already matches the server sort — nothing to reorder ({autoFixPreview.total} item{autoFixPreview.total === 1 ? "" : "s"}: {autoFixPreview.savedCount} saved, {autoFixPreview.unsavedCount} unsaved).
                              </div>
                            ) : (
                              <div className="text-foreground">
                                <span className="font-semibold">{autoFixPreview.moves.length}</span> of {autoFixPreview.total} item{autoFixPreview.total === 1 ? "" : "s"} will move
                                {" "}(<span className="font-mono">{autoFixPreview.savedMoves}</span> saved, <span className="font-mono">{autoFixPreview.unsavedMoves}</span> unsaved).
                                {autoFixPreview.localOnly ? (
                                  <span className="ml-1 rounded bg-muted px-1 py-px font-semibold text-foreground">
                                    Local only — no DB writes
                                  </span>
                                ) : (
                                  <span className="ml-1 rounded bg-primary/15 px-1 py-px font-semibold text-primary">
                                    Will persist to DB
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={autoFix.isPending || autoFixPreview.moves.length === 0}
                            onClick={() => setAutoFixPending(true)}
                            title={autoFixPreview.moves.length === 0 ? "Nothing to reorder" : "Preview and confirm reorder"}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-60"
                          >
                            <Wand2 className="h-3 w-3" /> Auto-fix order
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-1.5 text-[11px] text-foreground">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                            <div>
                              Confirm reorder: <span className="font-semibold">{autoFixPreview.moves.length}</span> of {autoFixPreview.total} item{autoFixPreview.total === 1 ? "" : "s"} will move
                              {" "}(<span className="font-mono">{autoFixPreview.savedMoves}</span> saved, <span className="font-mono">{autoFixPreview.unsavedMoves}</span> unsaved).
                              {" "}
                              {autoFixPreview.localOnly
                                ? "Only local order will change — no DB writes until you press Save."
                                : <>The new <code className="font-mono">display_order</code> will be persisted immediately.</>}
                            </div>
                          </div>
                          {autoFixPreview.moves.length > 0 && (
                            <ul className="max-h-32 overflow-auto rounded border border-border/60 bg-background/40 px-2 py-1 text-[10px] text-muted-foreground">
                              {autoFixPreview.moves.slice(0, 8).map((m, i) => (
                                <li key={`${m.from}-${m.to}-${i}`} className="font-mono">
                                  {m.isSaved ? "·" : "✱"} "{m.title}" — #{m.from + 1} → #{m.to + 1}
                                </li>
                              ))}
                              {autoFixPreview.moves.length > 8 && (
                                <li className="italic">… and {autoFixPreview.moves.length - 8} more</li>
                              )}
                            </ul>
                          )}
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={autoFix.isPending}
                              onClick={() => setAutoFixPending(false)}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary disabled:opacity-60"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={autoFix.isPending}
                              onClick={() => autoFix.mutate()}
                              className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/25 disabled:opacity-60"
                            >
                              {autoFix.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                              {autoFixPreview.localOnly ? "Confirm reorder" : "Confirm & save"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {autoFixUndo && !autoFixPending && (
                      <div className="flex items-center justify-between gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-[11px] text-foreground">
                        <div className="flex items-start gap-1.5">
                          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                          <div>
                            Auto-fix moved <span className="font-semibold">{autoFixUndo.movedCount}</span> item{autoFixUndo.movedCount === 1 ? "" : "s"}.{" "}
                            {autoFixUndo.persisted
                              ? <>Order was persisted to the DB. Undo will call <code className="font-mono">sync_sub_prompts</code> with the previous order (<code className="font-mono">created_at</code> stays untouched).</>
                              : <>Order was changed locally only. Undo will restore the previous order in the editor.</>}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            disabled={undoAutoFix.isPending}
                            onClick={() => undoAutoFix.mutate()}
                            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-500 hover:bg-emerald-500/25 disabled:opacity-60"
                          >
                            {undoAutoFix.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                            Undo auto-fix
                          </button>
                          <button
                            type="button"
                            disabled={undoAutoFix.isPending}
                            onClick={() => setAutoFixUndo(null)}
                            title="Dismiss undo option"
                            className="inline-flex items-center rounded-md border border-border px-1.5 py-1 text-[11px] hover:bg-secondary disabled:opacity-60"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    {fieldDiff.length > 0 && (
                      <div>
                        <div className="font-semibold text-foreground">Client vs server field diff</div>
                        <table className="mt-1 w-full text-left font-mono text-[10px]">
                          <thead className="text-muted-foreground">
                            <tr><th className="pr-3">field</th><th className="pr-3">client</th><th>server</th></tr>
                          </thead>
                          <tbody>
                            {fieldDiff.map((r) => (
                              <tr key={r.field}>
                                <td className="pr-3">{r.field}</td>
                                <td className="pr-3 text-amber-500">{String(r.client)}</td>
                                <td className="text-amber-500">{String(r.server)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {orderReport.gapItems.length > 0 && (
                      <div>
                        <div className="font-semibold text-foreground">Gap / mismatch ({orderReport.gapItems.length})</div>
                        <ul className="list-disc pl-4">
                          {orderReport.gapItems.map((g) => (
                            <li key={g.id}>
                              #{g.idx + 1} "{g.title}" — saved <code className="font-mono">{g.saved}</code>, expected <code className="font-mono">{g.expected}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {orderReport.duplicateItems.length > 0 && (
                      <div>
                        <div className="font-semibold text-foreground">Duplicate display_order</div>
                        <ul className="list-disc pl-4">
                          {orderReport.duplicateItems.map((d) => (
                            <li key={d.display_order}>
                              value <code className="font-mono">{d.display_order}</code> shared by:{" "}
                              {d.ids.map((x) => `#${x.idx + 1} "${x.title}"`).join(", ")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {orderReport.renderMismatchItems.length > 0 && (
                      <div>
                        <div className="font-semibold text-foreground">Render vs DB order</div>
                        <ul className="list-disc pl-4">
                          {orderReport.renderMismatchItems.map((m) => (
                            <li key={m.id}>
                              "{m.title}" — rendered at position {m.rendered + 1}, DB sort says {m.expected + 1}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {orderReport.missingOrderItems.length > 0 && (
                      <div>
                        <div className="font-semibold text-foreground">Missing display_order</div>
                        <ul className="list-disc pl-4">
                          {orderReport.missingOrderItems.map((m) => (
                            <li key={m.id}>#{m.idx + 1} "{m.title}"</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {orderReport.missingCreatedItems.length > 0 && (
                      <div>
                        <div className="font-semibold text-foreground">Missing created_at (id fallback applied)</div>
                        <ul className="list-disc pl-4">
                          {orderReport.missingCreatedItems.map((m) => (
                            <li key={m.id}>#{m.idx + 1} "{m.title}"</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>At least one sub-prompt is required before you can save.</span>
        </div>
      )}

      <div className="space-y-3">
        {items.map((s, i) => {
          const titleMissing = !s.title.trim();
          const contentMissing = !s.content.trim();
          const hasError = titleMissing || contentMissing;
          return (
          <div
            key={s.id ?? `new-${i}`}
            onDragOver={onDragOver(i)}
            onDrop={onDrop(i)}
            onDragEnd={onDragEnd}
            className={`rounded-lg border bg-card/40 p-4 space-y-3 transition ${hasError ? "border-destructive/50" : "border-border"} ${dragIdx === i ? "opacity-50" : ""} ${overIdx === i && dragIdx !== null && dragIdx !== i ? "ring-2 ring-primary/60" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span
                draggable
                onDragStart={onDragStart(i)}
                onDragEnd={onDragEnd}
                title="Drag to reorder"
                className="cursor-grab active:cursor-grabbing grid h-8 w-6 place-items-center rounded text-muted-foreground hover:text-foreground"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">#{i + 1}</span>
              <span
                title={`Saved display_order: ${s.saved_display_order ?? "—"} · created_at: ${s.saved_created_at ?? "—"}`}
                className={`text-[10px] font-mono rounded px-1.5 py-0.5 border ${
                  s.id == null
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : s.saved_display_order === i
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                }`}
              >
                {s.id == null ? "NEW" : `DB:${s.saved_display_order ?? "?"}`}
              </span>
              <input
                placeholder="Sub-prompt title"
                value={s.title}
                onChange={(e) => update(i, { title: e.target.value })}
                className={`flex-1 rounded-md border bg-input/40 px-2.5 py-1.5 text-sm font-semibold ${titleMissing ? "border-destructive/50" : "border-border"}`}
                aria-invalid={titleMissing}
              />
              <button onClick={() => move(i, -1)} disabled={i === 0} className="grid h-8 w-8 place-items-center rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"><ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="grid h-8 w-8 place-items-center rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
              <button onClick={() => setConfirmIdx(i)} className="grid h-8 w-8 place-items-center rounded border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
            {titleMissing && (
              <p className="text-xs text-destructive inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Title is required</p>
            )}

            <textarea
              placeholder="Prompt content (use [variable] for placeholders)"
              value={s.content}
              onChange={(e) => update(i, { content: e.target.value })}
              rows={6}
              className={`w-full rounded-md border bg-input/40 px-2.5 py-2 text-sm font-mono ${contentMissing ? "border-destructive/50" : "border-border"}`}
              aria-invalid={contentMissing}
            />
            {contentMissing && (
              <p className="text-xs text-destructive inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Content is required</p>
            )}

            <details className="rounded-md border border-border/60 bg-background/30">
              <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Info shown on "i" button
              </summary>
              <div className="p-3 space-y-3">
                <textarea
                  placeholder="Description"
                  value={s.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-border bg-input/40 px-2.5 py-1.5 text-sm"
                />
                <div className="grid sm:grid-cols-2 gap-2">
                  <select
                    value={s.difficulty ?? ""}
                    onChange={(e) => update(i, { difficulty: e.target.value || null })}
                    className="rounded-md border border-border bg-input/40 px-2.5 py-1.5 text-sm"
                  >
                    <option value="">— Difficulty —</option>
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">AI models</div>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_MODELS.map((m) => {
                      const active = s.ai_models.includes(m);
                      return (
                        <button key={m} type="button" onClick={() => toggleModel(i, m)}
                          className={`text-xs rounded-full border px-2.5 py-1 ${active ? "bg-primary/15 border-primary/40 text-primary" : "border-border bg-card/40 text-muted-foreground hover:text-foreground"}`}>
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <textarea
                  placeholder="Notes (markdown supported)"
                  value={s.notes}
                  onChange={(e) => update(i, { notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-border bg-input/40 px-2.5 py-1.5 text-sm font-mono"
                />
              </div>
            </details>
          </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No sub-prompts yet. Click "Add sub-prompt" — every page needs at least one.</p>
        )}
      </div>

      {confirmIdx !== null && items[confirmIdx] && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm px-4" onClick={() => setConfirmIdx(null)}>
          <div className="vault-card rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Delete this sub-prompt?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              "{items[confirmIdx].title || `Prompt ${confirmIdx + 1}`}" will be removed from this page. Changes apply after you save.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmIdx(null)} className="rounded-md border border-border px-3 py-1.5 text-sm">Cancel</button>
              <button
                onClick={() => { remove(confirmIdx); setConfirmIdx(null); }}
                className="rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
