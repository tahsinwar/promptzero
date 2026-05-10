import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { slugify } from "@/lib/slug";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/categories")({ component: Page });

function Page() {
  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-bold">Categories & Tags</h1>
      <CategoriesSection />
      <TagsSection />
    </div>
  );
}

function CategoriesSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");

  const { data } = useQuery({
    queryKey: ["admin-categories"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categories").insert({ name, slug: slug || slugify(name), color });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); setSlug(""); qc.invalidateQueries({ queryKey: ["admin-categories"] }); toast.success("Created"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categories").update({ name: editName, slug: editSlug || slugify(editName), color: editColor }).eq("id", editId!);
      if (error) throw error;
    },
    onSuccess: () => { setEditId(null); qc.invalidateQueries({ queryKey: ["admin-categories"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-categories"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (c: any) => { setEditId(c.id); setEditName(c.name); setEditSlug(c.slug); setEditColor(c.color ?? "#6366f1"); };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Categories</h2>
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}
        className="vault-card rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center"
      >
        <input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }}
          placeholder="Category name" maxLength={60}
          className="flex-1 min-w-[180px] rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))}
          placeholder="slug (auto)" maxLength={60}
          className="flex-1 min-w-[160px] rounded-lg border border-border bg-input/40 px-3 py-2 text-sm font-mono outline-none focus:border-primary" />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          className="h-10 w-14 rounded-lg border border-border bg-transparent cursor-pointer" />
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" />Add
        </button>
      </form>

      <div className="space-y-2">
        {data?.map((c) => (
          <div key={c.id} className="vault-card rounded-lg p-3 flex items-center gap-3">
            {editId === c.id ? (
              <>
                <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer" />
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 rounded border border-border bg-input/40 px-2 py-1.5 text-sm" />
                <input value={editSlug} onChange={(e) => setEditSlug(slugify(e.target.value))} className="w-40 rounded border border-border bg-input/40 px-2 py-1.5 text-sm font-mono" />
                <button onClick={() => update.mutate()} className="rounded-md bg-primary/15 text-primary p-2"><Check className="h-4 w-4" /></button>
                <button onClick={() => setEditId(null)} className="rounded-md p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
              </>
            ) : (
              <>
                <div className="h-8 w-8 rounded-md shrink-0" style={{ backgroundColor: c.color! }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">/{c.slug}</div>
                </div>
                <button onClick={() => startEdit(c)} className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-secondary"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => confirm(`Delete ${c.name}?`) && remove.mutate(c.id)} className="rounded-md p-2 text-muted-foreground hover:text-destructive hover:bg-secondary"><Trash2 className="h-4 w-4" /></button>
              </>
            )}
          </div>
        ))}
        {data && data.length === 0 && <p className="text-muted-foreground text-sm">No categories yet.</p>}
      </div>
    </section>
  );
}

function TagsSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-tags"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("tags").select("*").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("tags").insert({ name, slug: slugify(name) }); if (error) throw error; },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["admin-tags"] }); toast.success("Tag added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tags").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tags"] }),
  });

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Tags</h2>
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}
        className="vault-card rounded-xl p-4 mb-4 flex gap-3"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag name" maxLength={40}
          className="flex-1 rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" />Add tag
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {data?.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
            <span>#{t.name}</span>
            <button onClick={() => remove.mutate(t.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${t.name}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {data && data.length === 0 && <p className="text-muted-foreground text-sm">No tags yet.</p>}
      </div>
    </section>
  );
}
