import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Pin, Trash2, Ban, Send, MessageSquare, HelpCircle, Loader2 } from "lucide-react";
import { AdminTableSkeleton } from "@/components/admin-skeletons";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";

const search = z.object({
  tab: fallback(z.enum(["comments", "questions"]), "comments").default("comments"),
  filter: fallback(z.enum(["all", "pending", "approved"]), "all").default("all"),
});

export const Route = createFileRoute("/admin/comments")({
  validateSearch: zodValidator(search),
  component: Page,
});

function Page() {
  const { tab, filter } = Route.useSearch();
  const qc = useQueryClient();

  const comments = useQuery({
    queryKey: ["admin-comments"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("comments").select("*, prompts(title,slug)").order("created_at", { ascending: false })).data ?? [],
  });
  const questions = useQuery({
    queryKey: ["admin-questions"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("visitor_questions").select("*, prompts(title,slug)").order("created_at", { ascending: false })).data ?? [],
  });
  const settings = useQuery({
    queryKey: ["admin-settings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("admin_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  const pendingC = comments.data?.filter((c: any) => !c.is_approved).length ?? 0;
  const pendingQ = questions.data?.filter((q: any) => !q.is_published).length ?? 0;

  const updateC = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("comments").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-comments"] }); qc.invalidateQueries({ queryKey: ["admin-pending-comments"] }); },
  });
  const removeC = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("comments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-comments"] }); toast.success("Deleted"); },
  });
  const blockIP = useMutation({
    mutationFn: async (ip: string) => {
      const cur = settings.data?.settings as any || {};
      const list: string[] = Array.from(new Set([...(cur.blocked_ips ?? []), ip]));
      const { error } = await supabase.from("admin_settings").update({ settings: { ...cur, blocked_ips: list } }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-settings"] }); toast.success("IP blocked"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateQ = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("visitor_questions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-questions"] }),
  });
  const removeQ = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("visitor_questions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-questions"] }); toast.success("Deleted"); },
  });

  const filteredComments = useMemo(() => {
    const list = comments.data ?? [];
    if (filter === "pending") return list.filter((c: any) => !c.is_approved);
    if (filter === "approved") return list.filter((c: any) => c.is_approved);
    return list;
  }, [comments.data, filter]);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Comments & Questions</h1>

      {/* Top tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        <TabLink tab="comments" active={tab === "comments"} icon={MessageSquare} label="Comments" badge={pendingC} />
        <TabLink tab="questions" active={tab === "questions"} icon={HelpCircle} label="Questions" badge={pendingQ} />
      </div>

      {tab === "comments" ? (
        <>
          <div className="flex gap-2 mb-4">
            {(["all", "pending", "approved"] as const).map((f) => (
              <Link
                key={f}
                to="/admin/comments"
                search={{ tab: "comments", filter: f }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {f[0].toUpperCase() + f.slice(1)}
                {f === "pending" && pendingC > 0 && <span className="ml-1.5">({pendingC})</span>}
              </Link>
            ))}
          </div>

          <div className="vault-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Author</th>
                  <th className="text-left p-3">Prompt</th>
                  <th className="text-left p-3">Comment</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {comments.isLoading && !comments.data && (
                  <tr><td colSpan={6} className="p-0"><AdminTableSkeleton rows={5} cols={6} /></td></tr>
                )}
                {filteredComments.map((c: any) => (
                  <tr key={c.id} className="border-t border-border/60 align-top">
                    <td className="p-3">
                      <div className="font-medium">{c.author_name}</div>
                      {c.ip_address && <div className="text-xs text-muted-foreground font-mono">{c.ip_address}</div>}
                    </td>
                    <td className="p-3 max-w-[180px] truncate text-primary">{c.prompts?.title ?? "—"}</td>
                    <td className="p-3 max-w-[280px]">
                      <div className="line-clamp-2 text-foreground/85">{c.content}</div>
                      {c.is_pinned && <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase text-accent"><Pin className="h-3 w-3" />pinned</span>}
                    </td>
                    <td className="p-3">
                      {c.is_approved
                        ? <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs">Approved</span>
                        : <span className="rounded-full bg-accent/15 text-accent px-2 py-0.5 text-xs">Pending</span>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {(() => {
                          const isUpdating = updateC.isPending && (updateC.variables as any)?.id === c.id;
                          const isApproving = isUpdating && (updateC.variables as any)?.patch?.is_approved !== undefined;
                          const isPinning = isUpdating && (updateC.variables as any)?.patch?.is_pinned !== undefined;
                          const isBlocking = blockIP.isPending && blockIP.variables === c.ip_address;
                          const isDeleting = removeC.isPending && removeC.variables === c.id;
                          const rowBusy = isUpdating || isBlocking || isDeleting;
                          return (
                            <>
                              {!c.is_approved && (
                                <button disabled={rowBusy} title="Approve" onClick={() => updateC.mutate({ id: c.id, patch: { is_approved: true } })} className="rounded-md bg-primary/15 text-primary p-2 hover:bg-primary/25 disabled:opacity-60">
                                  {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                </button>
                              )}
                              <button disabled={rowBusy} title="Pin" onClick={() => updateC.mutate({ id: c.id, patch: { is_pinned: !c.is_pinned } })} className={`rounded-md p-2 disabled:opacity-60 ${c.is_pinned ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                                {isPinning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pin className="h-4 w-4" />}
                              </button>
                              {c.ip_address && (
                                <button disabled={rowBusy} title="Block IP" onClick={() => confirm(`Block ${c.ip_address}?`) && blockIP.mutate(c.ip_address)} className="rounded-md p-2 text-muted-foreground hover:text-destructive hover:bg-secondary disabled:opacity-60">
                                  {isBlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                                </button>
                              )}
                              <button disabled={rowBusy} title="Delete" onClick={() => confirm("Delete comment?") && removeC.mutate(c.id)} className="rounded-md p-2 text-muted-foreground hover:text-destructive hover:bg-secondary disabled:opacity-60">
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredComments.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No comments.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="vault-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Author</th>
                <th className="text-left p-3">Prompt</th>
                <th className="text-left p-3">Question</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.isLoading && !questions.data && (
                <tr><td colSpan={6} className="p-0"><AdminTableSkeleton rows={4} cols={6} /></td></tr>
              )}
              {(questions.data ?? []).map((q: any) => (
                <QRow
                  key={q.id}
                  q={q}
                  onSave={updateQ.mutate}
                  onDelete={removeQ.mutate}
                  pendingSave={updateQ.isPending && (updateQ.variables as any)?.id === q.id}
                  pendingDelete={removeQ.isPending && removeQ.variables === q.id}
                  anyMutating={updateQ.isPending || removeQ.isPending}
                />
              ))}
              {questions.data && questions.data.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No questions.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabLink({ tab, active, icon: Icon, label, badge }: any) {
  return (
    <Link
      to="/admin/comments"
      search={{ tab, filter: "all" }}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
    >
      <Icon className="h-4 w-4" /> {label}
      {badge > 0 && <span className="rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1.5 min-w-[18px] text-center">{badge}</span>}
    </Link>
  );
}

function QRow({ q, onSave, onDelete, pendingSave, pendingDelete, anyMutating }: any) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(q.answer ?? "");
  const busy = pendingSave || pendingDelete;
  return (
    <>
      <tr className="border-t border-border/60 align-top">
        <td className="p-3 font-medium">{q.author_name}</td>
        <td className="p-3 max-w-[180px] truncate text-primary">{q.prompts?.title ?? "—"}</td>
        <td className="p-3 max-w-[320px]">
          <div className="line-clamp-2">{q.question}</div>
          {q.is_published && q.answer && <div className="mt-1 text-xs text-muted-foreground line-clamp-1">A: {q.answer}</div>}
        </td>
        <td className="p-3">
          {q.is_published
            ? <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs">Published</span>
            : <span className="rounded-full bg-accent/15 text-accent px-2 py-0.5 text-xs">Pending</span>}
        </td>
        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(q.created_at).toLocaleDateString()}</td>
        <td className="p-3">
          <div className="flex justify-end gap-1">
            <button disabled={busy} onClick={() => setOpen((o) => !o)} className="rounded-md bg-primary/15 text-primary px-2.5 py-1 text-xs font-semibold hover:bg-primary/25 disabled:opacity-60">{open ? "Close" : "Answer"}</button>
            {q.is_published && (
              <button
                disabled={busy || anyMutating}
                onClick={() => { onSave({ id: q.id, patch: { is_published: false } }); toast.success("Unpublished"); }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-60"
              >
                {pendingSave && <Loader2 className="h-3 w-3 animate-spin" />}Unpublish
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => confirm("Delete question?") && onDelete(q.id)}
              className="rounded-md p-2 text-muted-foreground hover:text-destructive hover:bg-secondary disabled:opacity-60"
              title="Delete"
            >
              {pendingDelete ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-border/60 bg-secondary/20">
          <td colSpan={6} className="p-3">
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Write your answer…" rows={3}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary resize-none" />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => { onSave({ id: q.id, patch: { answer, is_published: true } }); toast.success("Published"); setOpen(false); }}
                disabled={!answer.trim() || busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                {pendingSave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Publish answer
              </button>
              <button
                disabled={busy}
                onClick={() => { onSave({ id: q.id, patch: { answer, is_published: false } }); toast.success("Saved"); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-60"
              >
                {pendingSave && <Loader2 className="h-3 w-3 animate-spin" />}Save draft
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
