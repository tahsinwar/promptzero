import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, Loader2, History } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function VersionHistoryDrawer({
  promptId,
  open,
  onClose,
  onRestored,
}: {
  promptId: string;
  open: boolean;
  onClose: () => void;
  onRestored?: () => void;
}) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["prompt-versions", promptId],
    enabled: open && !!promptId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompt_versions")
        .select("*")
        .eq("prompt_id", promptId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = versions.find((v: any) => v.id === selectedId) ?? versions[0];

  const restore = useMutation({
    mutationFn: async (versionId: string) => {
      const v = versions.find((x: any) => x.id === versionId);
      if (!v) throw new Error("Version not found");
      // snapshot current first
      const { data: cur } = await supabase.from("prompts").select("content").eq("id", promptId).single();
      if (cur?.content) {
        await supabase.from("prompt_versions").insert({
          prompt_id: promptId,
          content: cur.content,
          change_note: "Snapshot before restore",
        });
      }
      const { error } = await supabase.from("prompts").update({ content: v.content }).eq("id", promptId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Version restored");
      qc.invalidateQueries({ queryKey: ["edit-prompt", promptId] });
      qc.invalidateQueries({ queryKey: ["prompt-versions", promptId] });
      onRestored?.();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 240 }}
            className="fixed right-0 top-0 z-50 h-screen w-full max-w-3xl bg-card border-l border-border flex flex-col"
          >
            <header className="h-14 flex items-center justify-between px-5 border-b border-border">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Version History</h2>
                <span className="text-xs text-muted-foreground">{versions.length} version{versions.length === 1 ? "" : "s"}</span>
              </div>
              <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
            </header>

            <div className="flex flex-1 min-h-0">
              {/* Sidebar list */}
              <div className="w-64 border-r border-border overflow-y-auto">
                {isLoading && <div className="p-4 text-xs text-muted-foreground">Loading…</div>}
                {!isLoading && versions.length === 0 && (
                  <div className="p-4 text-xs text-muted-foreground">No previous versions yet. Snapshots are created automatically on save.</div>
                )}
                {versions.map((v: any) => {
                  const isActive = (selected?.id ?? versions[0]?.id) === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedId(v.id)}
                      className={`w-full text-left px-4 py-3 border-b border-border/60 transition-colors ${isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/40"}`}
                    >
                      <div className="text-xs font-medium">{new Date(v.changed_at).toLocaleString()}</div>
                      {v.change_note && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{v.change_note}</div>}
                    </button>
                  );
                })}
              </div>

              {/* Preview */}
              <div className="flex-1 min-w-0 flex flex-col">
                {selected ? (
                  <>
                    <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground truncate">
                        {new Date(selected.changed_at).toLocaleString()}
                      </div>
                      <button
                        disabled={restore.isPending}
                        onClick={() => { if (selected?.id && confirm("Restore this version? Current content will be snapshotted first.")) restore.mutate(selected.id); }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                      >
                        {restore.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        Restore this version
                      </button>
                    </div>
                    <pre className="flex-1 overflow-auto p-5 text-xs font-mono text-foreground/90 whitespace-pre-wrap">{selected.content}</pre>
                  </>
                ) : (
                  <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Select a version to preview</div>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}