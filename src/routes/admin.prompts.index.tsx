import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Copy, Search, X, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/slug";
import { ShareModal } from "@/components/share-modal";

export const Route = createFileRoute("/admin/prompts/")({ component: PromptsList });

const PAGE_SIZE = 20;
const STATUSES = ["all", "published", "draft", "archived"] as const;
type Status = typeof STATUSES[number];

function PromptsList() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [shareFor, setShareFor] = useState<{ slug: string; title: string } | null>(null);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("categories").select("id,name").order("name")).data ?? [],
  });

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["admin-prompts"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("prompts").select("id,title,slug,status,is_published,copy_count,created_at,category_id, categories(name,color)").order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = useMemo(() => {
    return prompts.filter((p: any) => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (status !== "all" && p.status !== status) return false;
      if (categoryId !== "all" && p.category_id !== categoryId) return false;
      return true;
    });
  }, [prompts, search, status, categoryId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSel = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (pageItems.every((p: any) => selected.has(p.id))) {
      const next = new Set(selected);
      pageItems.forEach((p: any) => next.delete(p.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      pageItems.forEach((p: any) => next.add(p.id));
      setSelected(next);
    }
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prompts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-prompts"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkUpdate = useMutation({
    mutationFn: async (patch: { status: string; is_published: boolean }) => {
      const ids = Array.from(selected);
      const { error } = await supabase.from("prompts").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-prompts"] }); setSelected(new Set()); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase.from("prompts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-prompts"] }); setSelected(new Set()); setConfirmBulkDelete(false); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const { data: src, error: e1 } = await supabase.from("prompts").select("*").eq("id", id).single();
      if (e1 || !src) throw e1 ?? new Error("Not found");
      const { id: _i, created_at, updated_at, view_count, copy_count, rating_avg, ...rest } = src as any;
      const newTitle = `${src.title} (Copy)`;
      const newSlug = `${slugify(newTitle)}-${Date.now().toString(36).slice(-4)}`;
      const { data: ins, error: e2 } = await supabase.from("prompts").insert({ ...rest, title: newTitle, slug: newSlug, status: "draft", is_published: false, is_featured: false }).select("id").single();
      if (e2) throw e2;
      // duplicate tags
      const { data: tagRows } = await supabase.from("prompt_tags").select("tag_id").eq("prompt_id", id);
      if (tagRows && tagRows.length) {
        await supabase.from("prompt_tags").insert(tagRows.map((r: any) => ({ prompt_id: ins.id, tag_id: r.tag_id })));
      }
      return ins.id as string;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["admin-prompts"] });
      toast.success("Duplicated");
      nav({ to: "/admin/prompts/$id", params: { id: newId } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <h1 className="text-3xl font-bold">Prompts</h1>
        <Link to="/admin/prompts/$id" params={{ id: "new" }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> New prompt
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by title…"
            className="w-full rounded-lg border border-border bg-input/40 pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value as Status); setPage(1); }}
          className="rounded-lg border border-border bg-input/40 px-3 py-2 text-sm">
          {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All status" : s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-input/40 px-3 py-2 text-sm">
          <option value="all">All categories</option>
          {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="vault-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 w-10">
                  <input type="checkbox" checked={pageItems.length > 0 && pageItems.every((p: any) => selected.has(p.id))} onChange={toggleAll} />
                </th>
                <th className="px-3 py-2.5 text-left">Title</th>
                <th className="px-3 py-2.5 text-left">Category</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-left">Copies</th>
                <th className="px-3 py-2.5 text-left">Created</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={7} className="px-3 py-3"><div className="h-6 rounded bg-primary/10 animate-pulse" /></td>
                </tr>
              ))}
              {!isLoading && pageItems.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">No prompts match.</td></tr>
              )}
              {pageItems.map((p: any) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                  <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} /></td>
                  <td className="px-3 py-2.5">
                    <Link to="/admin/prompts/$id" params={{ id: p.id }} className="font-medium hover:text-primary">{p.title}</Link>
                    <div className="text-xs text-muted-foreground">/{p.slug}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    {p.categories ? (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${p.categories.color}25`, color: p.categories.color }}>{p.categories.name}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={p.status ?? "draft"} /></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.copy_count ?? 0}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Link to="/admin/prompts/$id" params={{ id: p.id }} className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:text-primary hover:bg-secondary" title="Edit"><Pencil className="h-4 w-4" /></Link>
                      <button onClick={() => setShareFor({ slug: p.slug, title: p.title })} className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:text-primary hover:bg-secondary" title="Share"><Share2 className="h-4 w-4" /></button>
                      <button disabled={duplicate.isPending} onClick={() => duplicate.mutate(p.id)} className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50" title="Duplicate">{duplicate.isPending && duplicate.variables === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}</button>
                      <button disabled={remove.isPending} onClick={() => window.confirm(`Delete "${p.title}"?`) && remove.mutate(p.id)} className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:text-destructive hover:bg-secondary disabled:opacity-50" title="Delete">{remove.isPending && remove.variables === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span>{filtered.length} prompts</span>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded px-2 py-1 hover:bg-secondary disabled:opacity-30">Prev</button>
              <span>Page {page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="rounded px-2 py-1 hover:bg-secondary disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 vault-card rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-card">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <button disabled={bulkUpdate.isPending} onClick={() => bulkUpdate.mutate({ status: "published", is_published: true })} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">Publish</button>
          <button disabled={bulkUpdate.isPending} onClick={() => bulkUpdate.mutate({ status: "draft", is_published: false })} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-60">Unpublish</button>
          <button disabled={bulkDelete.isPending} onClick={() => setConfirmBulkDelete(true)} className="rounded-md border border-destructive/40 text-destructive px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-60">Delete</button>
          <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm px-4" onClick={() => setConfirmBulkDelete(false)}>
          <div className="vault-card rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Delete {selected.size} prompts?</h3>
            <p className="mt-2 text-sm text-muted-foreground">This action can't be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button disabled={bulkDelete.isPending} onClick={() => setConfirmBulkDelete(false)} className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-60">Cancel</button>
              <button disabled={bulkDelete.isPending} onClick={() => bulkDelete.mutate()} className="rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5">{bulkDelete.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Delete</button>
            </div>
          </div>
        </div>
      )}

      <ShareModal
        open={!!shareFor}
        url={shareFor && typeof window !== "undefined" ? `${window.location.origin}/p/${shareFor.slug}` : ""}
        title={shareFor?.title ?? ""}
        onClose={() => setShareFor(null)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-primary/15 text-primary",
    draft: "bg-secondary text-muted-foreground",
    archived: "bg-destructive/15 text-destructive",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${map[status] ?? map.draft}`}>{status}</span>;
}
