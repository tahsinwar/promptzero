import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Ban, Check, Loader2, Plus, Shield, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AdminTableSkeleton } from "@/components/admin-skeletons";

export const Route = createFileRoute("/admin/security")({ component: Page });

function Page() {
  const qc = useQueryClient();

  const attempts = useQuery({
    queryKey: ["admin-pin-attempts"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pin_attempts" as any)
        .select("*, prompts(title,slug)")
        .order("attempted_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const settings = useQuery({
    queryKey: ["admin-settings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("admin_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  const blockedIps: string[] = ((settings.data?.settings as any)?.blocked_ips as string[]) ?? [];

  const [newIp, setNewIp] = useState("");

  const setBlocked = useMutation({
    mutationFn: async (next: string[]) => {
      const cur = (settings.data?.settings as any) ?? {};
      const { error } = await supabase.from("admin_settings").update({ settings: { ...cur, blocked_ips: next } }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-settings"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addIp = () => {
    const ip = newIp.trim();
    if (!ip) return;
    if (blockedIps.includes(ip)) { toast.error("Already blocked"); return; }
    setBlocked.mutate([...blockedIps, ip]);
    setNewIp("");
    toast.success("IP blocked");
  };
  const removeIp = (ip: string) => setBlocked.mutate(blockedIps.filter((x) => x !== ip));

  const clearAttempts = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pin_attempts" as any).delete().not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cleared"); qc.invalidateQueries({ queryKey: ["admin-pin-attempts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const list = attempts.data ?? [];
    const failed = list.filter((a) => !a.success).length;
    const success = list.filter((a) => a.success).length;
    const uniqueIps = new Set(list.map((a) => a.ip_address).filter(Boolean)).size;
    return { total: list.length, failed, success, uniqueIps };
  }, [attempts.data]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" /> Security
        </h1>
        <p className="text-sm text-muted-foreground mt-1">PIN attempt audit log and IP block list.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total attempts" value={stats.total} />
        <Stat label="Successful" value={stats.success} accent="text-emerald-400" />
        <Stat label="Failed" value={stats.failed} accent="text-destructive" />
        <Stat label="Unique IPs" value={stats.uniqueIps} />
      </div>

      {/* Blocked IPs */}
      <section className="vault-card rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Ban className="h-4 w-4 text-destructive" /> Blocked IPs</h2>
          <span className="text-xs text-muted-foreground">{blockedIps.length} blocked</span>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addIp()}
            placeholder="e.g. 192.168.1.42"
            className="flex-1 rounded-lg border border-border bg-input/40 px-3 py-2 text-sm font-mono outline-none focus:border-primary"
          />
          <button
            onClick={addIp}
            disabled={setBlocked.isPending || !newIp.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {setBlocked.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Block
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {blockedIps.length === 0 && <p className="text-xs text-muted-foreground">No blocked IPs yet.</p>}
          {blockedIps.map((ip) => (
            <span key={ip} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-mono">
              {ip}
              <button onClick={() => removeIp(ip)} className="text-muted-foreground hover:text-destructive" aria-label={`Unblock ${ip}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* Attempts log */}
      <section className="vault-card rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-400" /> PIN attempts</h2>
          {(attempts.data?.length ?? 0) > 0 && (
            <button
              onClick={() => confirm("Clear all PIN attempt logs?") && clearAttempts.mutate()}
              disabled={clearAttempts.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-60"
            >
              {clearAttempts.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Clear log
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">When</th>
              <th className="text-left p-3">Prompt</th>
              <th className="text-left p-3">IP</th>
              <th className="text-left p-3">Result</th>
              <th className="text-left p-3">User agent</th>
              <th className="text-right p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {attempts.isLoading && !attempts.data && (
              <tr><td colSpan={6} className="p-0"><AdminTableSkeleton rows={5} cols={6} /></td></tr>
            )}
            {(attempts.data ?? []).map((a) => (
              <tr key={a.id} className="border-t border-border/60 align-top">
                <td className="p-3 text-xs whitespace-nowrap">{new Date(a.attempted_at).toLocaleString()}</td>
                <td className="p-3 max-w-[200px] truncate text-primary">{a.prompts?.title ?? "—"}</td>
                <td className="p-3 font-mono text-xs">{a.ip_address ?? "—"}</td>
                <td className="p-3">
                  {a.success
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.5 text-xs"><Check className="h-3 w-3" />Success</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-xs"><X className="h-3 w-3" />Failed</span>}
                </td>
                <td className="p-3 max-w-[260px] truncate text-xs text-muted-foreground" title={a.user_agent}>{a.user_agent ?? "—"}</td>
                <td className="p-3 text-right">
                  {a.ip_address && !blockedIps.includes(a.ip_address) && (
                    <button
                      onClick={() => { if (confirm(`Block ${a.ip_address}?`)) { setBlocked.mutate([...blockedIps, a.ip_address]); toast.success("IP blocked"); } }}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/40 text-destructive px-2.5 py-1 text-xs hover:bg-destructive/10"
                    >
                      <Ban className="h-3 w-3" /> Block IP
                    </button>
                  )}
                  {a.ip_address && blockedIps.includes(a.ip_address) && (
                    <span className="text-xs text-muted-foreground">Blocked</span>
                  )}
                </td>
              </tr>
            ))}
            {attempts.data && attempts.data.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No PIN attempts logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="vault-card rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}