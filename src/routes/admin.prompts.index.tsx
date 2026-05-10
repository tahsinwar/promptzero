import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Eye, EyeOff, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/prompts/")({ component: PromptsList });

function PromptsList() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-prompts"],
    queryFn: async () => (await supabase.from("prompts").select("*, categories(name,color)").order("created_at", { ascending: false })).data ?? [],
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: any) => { const { error } = await supabase.from("prompts").update(patch).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-prompts"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("prompts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-prompts"] }); toast.success("Deleted"); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Prompts</h1>
        <Link to="/admin/prompts/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"><Plus className="h-4 w-4" />New prompt</Link>
      </div>
      <div className="space-y-2">
        {data?.map((p: any) => (
          <div key={p.id} className="vault-card rounded-xl p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{p.title}</span>
                {p.categories && <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${p.categories.color}25`, color: p.categories.color }}>{p.categories.name}</span>}
                {p.is_featured && <Star className="h-3.5 w-3.5 text-accent fill-accent" />}
              </div>
              <div className="text-xs text-muted-foreground mt-1">/{p.slug} • {p.view_count} views • {p.copy_count} copies</div>
            </div>
            <button onClick={() => update.mutate({ id: p.id, patch: { is_published: !p.is_published } })} className="p-2 text-muted-foreground hover:text-foreground" title={p.is_published ? "Unpublish" : "Publish"}>
              {p.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button onClick={() => update.mutate({ id: p.id, patch: { is_featured: !p.is_featured } })} className={`p-2 ${p.is_featured ? "text-accent" : "text-muted-foreground hover:text-foreground"}`} title="Feature">
              <Star className="h-4 w-4" />
            </button>
            <Link to="/admin/prompts/$id" params={{ id: p.id }} className="p-2 text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></Link>
            <button onClick={() => confirm(`Delete "${p.title}"?`) && remove.mutate(p.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {data && data.length === 0 && <div className="vault-card rounded-xl p-10 text-center text-muted-foreground">No prompts yet. Create your first one!</div>}
      </div>
    </div>
  );
}
