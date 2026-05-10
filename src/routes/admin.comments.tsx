import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Pin, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/comments")({ component: Comments });

function Comments() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-comments"],
    queryFn: async () => (await supabase.from("comments").select("*, prompts(title,slug)").order("created_at", { ascending: false })).data ?? [],
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => { const { error } = await supabase.from("comments").update(patch).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-comments"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("comments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-comments"] }); toast.success("Deleted"); },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Comments</h1>
      <div className="space-y-3">
        {data?.map((c: any) => (
          <div key={c.id} className="vault-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="text-sm">
                <span className="font-medium">{c.author_name}</span>
                <span className="text-muted-foreground"> on </span>
                <span className="text-primary">{c.prompts?.title}</span>
              </div>
              <div className="flex gap-1">
                {!c.is_approved && (
                  <button onClick={() => update.mutate({ id: c.id, patch: { is_approved: true } })} className="rounded-md bg-primary/15 text-primary p-2" title="Approve"><Check className="h-4 w-4" /></button>
                )}
                <button onClick={() => update.mutate({ id: c.id, patch: { is_pinned: !c.is_pinned } })} className={`rounded-md p-2 ${c.is_pinned ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground"}`} title="Pin"><Pin className="h-4 w-4" /></button>
                <button onClick={() => confirm("Delete?") && remove.mutate(c.id)} className="rounded-md p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <p className="text-sm text-foreground/85 whitespace-pre-wrap">{c.content}</p>
            <div className="mt-2 text-xs">
              {c.is_approved ? <span className="text-primary">Approved</span> : <span className="text-accent">Pending</span>}
              <span className="text-muted-foreground"> • {new Date(c.created_at).toLocaleString()}</span>
            </div>
          </div>
        ))}
        {data && data.length === 0 && <p className="text-muted-foreground text-sm">No comments yet.</p>}
      </div>
    </div>
  );
}
