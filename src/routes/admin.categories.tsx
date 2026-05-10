import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { slugify } from "@/lib/slug";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/categories")({ component: Categories });

function Categories() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");

  const { data } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categories").insert({ name, slug: slugify(name), color });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["admin-categories"] }); toast.success("Created"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-categories"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Categories</h1>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }} className="vault-card rounded-xl p-4 mb-6 flex gap-3 flex-wrap">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" maxLength={60}
          className="flex-1 min-w-[200px] rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 rounded-lg border border-border bg-transparent cursor-pointer" />
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Add</button>
      </form>
      <div className="space-y-2">
        {data?.map((c) => (
          <div key={c.id} className="vault-card rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md" style={{ backgroundColor: c.color! }} />
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">/{c.slug}</div>
              </div>
            </div>
            <button onClick={() => confirm(`Delete ${c.name}?`) && remove.mutate(c.id)} className="text-muted-foreground hover:text-destructive p-2"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {data && data.length === 0 && <p className="text-muted-foreground text-sm">No categories yet.</p>}
      </div>
    </div>
  );
}
