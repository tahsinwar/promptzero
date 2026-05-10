import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Trash2, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/questions")({ component: Questions });

function Questions() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-questions"],
    queryFn: async () => (await supabase.from("visitor_questions").select("*, prompts(title)").order("created_at", { ascending: false })).data ?? [],
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => { const { error } = await supabase.from("visitor_questions").update(patch).eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-questions"] }); toast.success("Saved"); },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("visitor_questions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-questions"] }),
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Visitor Questions</h1>
      <div className="space-y-3">
        {data?.map((q: any) => <QRow key={q.id} q={q} onSave={update.mutate} onDelete={remove.mutate} />)}
        {data && data.length === 0 && <p className="text-muted-foreground text-sm">No questions yet.</p>}
      </div>
    </div>
  );
}

function QRow({ q, onSave, onDelete }: any) {
  const [answer, setAnswer] = useState(q.answer ?? "");
  return (
    <div className="vault-card rounded-xl p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="text-sm">
          <span className="font-medium">{q.author_name}</span>
          <span className="text-muted-foreground"> asked on </span>
          <span className="text-primary">{q.prompts?.title}</span>
        </div>
        <button onClick={() => confirm("Delete?") && onDelete(q.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
      </div>
      <p className="text-sm mb-3">{q.question}</p>
      <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Write your answer…" rows={3}
        className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary resize-none" />
      <div className="mt-2 flex gap-2">
        <button onClick={() => onSave({ id: q.id, patch: { answer, is_published: true } })} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"><Send className="h-3.5 w-3.5" />Publish answer</button>
        <button onClick={() => onSave({ id: q.id, patch: { answer, is_published: false } })} className="rounded-lg border border-border px-3 py-1.5 text-xs">Save draft</button>
        <span className="ml-auto self-center text-xs">{q.is_published ? <span className="text-primary">Published</span> : <span className="text-muted-foreground">Draft</span>}</span>
      </div>
    </div>
  );
}
