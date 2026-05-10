import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { slugify } from "@/lib/slug";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/tags")({ component: Tags });

function Tags() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-tags"],
    queryFn: async () => (await supabase.from("tags").select("*").order("name")).data ?? [],
  });
  const create = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("tags").insert({ name, slug: slugify(name) }); if (error) throw error; },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["admin-tags"] }); toast.success("Created"); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tags").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tags"] }); toast.success("Deleted"); },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Tags</h1>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }} className="vault-card rounded-xl p-4 mb-6 flex gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag name" maxLength={40}
          className="flex-1 rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Add</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {data?.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
            #{t.slug}
            <button onClick={() => remove.mutate(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
          </span>
        ))}
        {data && data.length === 0 && <p className="text-muted-foreground text-sm">No tags yet.</p>}
      </div>
    </div>
  );
}
