import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { slugify } from "@/lib/slug";
import { Save, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/prompts/$id")({ component: EditPrompt });

function EditPrompt() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });
  const { data: tags } = useQuery({
    queryKey: ["admin-tags"],
    queryFn: async () => (await supabase.from("tags").select("*").order("name")).data ?? [],
  });
  const { data: prompt } = useQuery({
    queryKey: ["edit-prompt", id],
    enabled: !isNew,
    queryFn: async () => (await supabase.from("prompts").select("*").eq("id", id).single()).data,
  });
  const { data: existingTagIds } = useQuery({
    queryKey: ["edit-prompt-tags", id],
    enabled: !isNew,
    queryFn: async () => (await supabase.from("prompt_tags").select("tag_id").eq("prompt_id", id)).data?.map((r: any) => r.tag_id) ?? [],
  });
  const { data: videos, refetch: refetchVideos } = useQuery({
    queryKey: ["edit-prompt-videos", id], enabled: !isNew,
    queryFn: async () => (await supabase.from("prompt_videos").select("*").eq("prompt_id", id).order("display_order")).data ?? [],
  });
  const { data: links, refetch: refetchLinks } = useQuery({
    queryKey: ["edit-prompt-links", id], enabled: !isNew,
    queryFn: async () => (await supabase.from("prompt_links").select("*").eq("prompt_id", id).order("display_order")).data ?? [],
  });
  const { data: qa, refetch: refetchQa } = useQuery({
    queryKey: ["edit-prompt-qa", id], enabled: !isNew,
    queryFn: async () => (await supabase.from("prompt_qa").select("*").eq("prompt_id", id).order("display_order")).data ?? [],
  });

  const [form, setForm] = useState<any>({
    title: "", slug: "", description: "", content: "", notes: "",
    category_id: null, ai_models: [], difficulty: "intermediate",
    is_published: true, is_featured: false,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => { if (prompt) setForm({ ...prompt, ai_models: prompt.ai_models ?? [] }); }, [prompt]);
  useEffect(() => { if (existingTagIds) setSelectedTags(existingTagIds); }, [existingTagIds]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.content.trim()) throw new Error("Title and content are required");
      const payload = { ...form, slug: form.slug?.trim() || slugify(form.title) };
      delete payload.created_at; delete payload.updated_at;
      let pid = id;
      if (isNew) {
        delete payload.id;
        const { data, error } = await supabase.from("prompts").insert(payload).select("id").single();
        if (error) throw error; pid = data.id;
      } else {
        const { error } = await supabase.from("prompts").update(payload).eq("id", id);
        if (error) throw error;
      }
      // sync tags
      await supabase.from("prompt_tags").delete().eq("prompt_id", pid);
      if (selectedTags.length) {
        await supabase.from("prompt_tags").insert(selectedTags.map((tag_id) => ({ prompt_id: pid, tag_id })));
      }
      return pid;
    },
    onSuccess: (pid) => {
      qc.invalidateQueries({ queryKey: ["admin-prompts"] });
      toast.success("Saved");
      if (isNew) nav({ to: "/admin/prompts/$id", params: { id: pid! } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const aiModelsStr = (form.ai_models ?? []).join(", ");

  return (
    <div className="max-w-3xl">
      <Link to="/admin/prompts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" />Back to prompts</Link>
      <h1 className="text-3xl font-bold mb-6">{isNew ? "New prompt" : "Edit prompt"}</h1>

      <div className="vault-card rounded-xl p-6 space-y-4">
        <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v, slug: isNew && !form.slug ? slugify(v) : form.slug })} />
        <Input label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="auto-generated" />
        <Input label="Description" value={form.description ?? ""} onChange={(v) => setForm({ ...form, description: v })} />
        <Textarea label="Content (the prompt)" value={form.content} onChange={(v) => setForm({ ...form, content: v })} rows={10} required />
        <Textarea label="Notes" value={form.notes ?? ""} onChange={(v) => setForm({ ...form, notes: v })} rows={3} />
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Category</span>
            <select value={form.category_id ?? ""} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}
              className="mt-1 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm">
              <option value="">— None —</option>
              {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Difficulty</span>
            <select value={form.difficulty ?? ""} onChange={(e) => setForm({ ...form, difficulty: e.target.value || null })}
              className="mt-1 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm">
              <option value="">—</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
        </div>
        <Input label="AI models (comma-separated)" value={aiModelsStr} onChange={(v) => setForm({ ...form, ai_models: v.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="GPT-5, Claude, Gemini" />

        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Tags</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {tags?.map((t) => {
              const active = selectedTags.includes(t.id);
              return (
                <button key={t.id} type="button"
                  onClick={() => setSelectedTags(active ? selectedTags.filter((x) => x !== t.id) : [...selectedTags, t.id])}
                  className={`rounded-full border px-3 py-1 text-xs ${active ? "bg-primary/15 border-primary/40 text-primary" : "border-border bg-card/40 text-muted-foreground"}`}>
                  #{t.slug}
                </button>
              );
            })}
            {tags && tags.length === 0 && <span className="text-xs text-muted-foreground">No tags yet — create some in Tags.</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />Published</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />Featured</label>
        </div>

        <button onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
          <Save className="h-4 w-4" />{save.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      {!isNew && (
        <>
          <RelatedSection title="Videos" items={videos ?? []} promptId={id} table="prompt_videos" refetch={refetchVideos}
            fields={[{ key: "youtube_url", label: "YouTube URL", required: true }, { key: "title", label: "Title" }]} />
          <RelatedSection title="Links" items={links ?? []} promptId={id} table="prompt_links" refetch={refetchLinks}
            fields={[{ key: "title", label: "Title", required: true }, { key: "url", label: "URL", required: true }, { key: "link_type", label: "Type" }, { key: "description", label: "Description" }]} />
          <RelatedSection title="Q&A" items={qa ?? []} promptId={id} table="prompt_qa" refetch={refetchQa}
            fields={[{ key: "question", label: "Question", required: true }, { key: "answer", label: "Answer", required: true, textarea: true }]} />
        </>
      )}
    </div>
  );
}

function Input({ label, value, onChange, placeholder, required }: any) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}{required && " *"}</span>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
    </label>
  );
}

function Textarea({ label, value, onChange, rows = 4, required }: any) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}{required && " *"}</span>
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="mt-1 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary font-mono leading-relaxed resize-y" />
    </label>
  );
}

function RelatedSection({ title, items, promptId, table, refetch, fields }: any) {
  const [draft, setDraft] = useState<any>({});
  const add = async () => {
    for (const f of fields) if (f.required && !draft[f.key]) { toast.error(`${f.label} is required`); return; }
    const { error } = await supabase.from(table).insert({ ...draft, prompt_id: promptId });
    if (error) { toast.error(error.message); return; }
    setDraft({}); refetch(); toast.success("Added");
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetch();
  };

  return (
    <section className="mt-8 vault-card rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="space-y-2 mb-4">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/40 p-3">
            <div className="flex-1 min-w-0 text-sm">
              {fields.map((f: any) => item[f.key] && <div key={f.key} className="truncate"><span className="text-xs text-muted-foreground uppercase">{f.label}: </span>{item[f.key]}</div>)}
            </div>
            <button onClick={() => remove(item.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
      </div>
      <div className="grid gap-2">
        {fields.map((f: any) => f.textarea ? (
          <textarea key={f.key} placeholder={f.label + (f.required ? " *" : "")} value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} rows={2}
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm" />
        ) : (
          <input key={f.key} placeholder={f.label + (f.required ? " *" : "")} value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm" />
        ))}
        <button onClick={add} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground self-start"><Plus className="h-4 w-4" />Add {title.toLowerCase().replace(/s$/, "")}</button>
      </div>
    </section>
  );
}
