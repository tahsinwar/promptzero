import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Save, Eye, EyeOff, X, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminFormSkeleton } from "@/components/admin-skeletons";

export const Route = createFileRoute("/admin/settings")({ component: Page });

type Settings = {
  site_name?: string;
  tagline?: string;
  logo_url?: string;
  default_pin?: string;
  auto_lock_minutes?: number;
  comment_auto_approve?: boolean;
  accent_color?: string;
  blocked_ips?: string[];
  spam_keywords?: string[];
};

function applyAccent(color?: string) {
  if (!color) return;
  document.documentElement.style.setProperty("--primary", color);
}

function Page() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => (await supabase.from("admin_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  const [s, setS] = useState<Settings>({});
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (data?.settings) setS(data.settings as Settings);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("admin_settings").update({ settings: s }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      applyAccent(s.accent_color);
      toast.success("Settings saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unblock = (ip: string) => {
    setS({ ...s, blocked_ips: (s.blocked_ips ?? []).filter((x) => x !== ip) });
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {isLoading && !data ? <AdminFormSkeleton /> : (
      <div className="vault-card rounded-xl p-6 space-y-5">
        <Field label="Site name" value={s.site_name ?? ""} onChange={(v) => setS({ ...s, site_name: v })} />
        <Field label="Tagline" value={s.tagline ?? ""} onChange={(v) => setS({ ...s, tagline: v })} />

        <div>
          <Field label="Logo URL" value={s.logo_url ?? ""} onChange={(v) => setS({ ...s, logo_url: v })} />
          {s.logo_url && (
            <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-3">
              <img src={s.logo_url} alt="Logo preview" style={{ maxHeight: 40 }} className="w-auto" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            </div>
          )}
        </div>

        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Default PIN</span>
          <div className="mt-1 flex gap-2">
            <input
              type={showPin ? "text" : "password"}
              value={s.default_pin ?? ""}
              onChange={(e) => setS({ ...s, default_pin: e.target.value.replace(/\D/g, "").slice(0, 5) })}
              maxLength={5}
              placeholder="•••••"
              className="flex-1 rounded-lg border border-border bg-input/40 px-3 py-2 text-sm font-mono tracking-widest outline-none focus:border-primary"
            />
            <button type="button" onClick={() => setShowPin((v) => !v)} className="rounded-lg border border-border px-3 text-muted-foreground hover:text-foreground">
              {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Auto-lock timer</span>
          <select
            value={s.auto_lock_minutes ?? 0}
            onChange={(e) => setS({ ...s, auto_lock_minutes: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value={0}>Never</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
          </select>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div>
            <div className="text-sm font-medium">Auto-approve comments</div>
            <div className="text-xs text-muted-foreground">Skip moderation for new comments.</div>
          </div>
          <input type="checkbox" checked={!!s.comment_auto_approve} onChange={(e) => setS({ ...s, comment_auto_approve: e.target.checked })} className="h-4 w-4" />
        </label>

        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Accent color</span>
          <div className="mt-1 flex gap-2 items-center">
            <input type="color" value={s.accent_color ?? "#6366f1"} onChange={(e) => setS({ ...s, accent_color: e.target.value })}
              className="h-11 w-16 rounded-lg border border-border bg-transparent cursor-pointer" />
            <input value={s.accent_color ?? ""} onChange={(e) => setS({ ...s, accent_color: e.target.value })}
              className="flex-1 rounded-lg border border-border bg-input/40 px-3 py-2 text-sm font-mono outline-none focus:border-primary" />
          </div>
        </div>

        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Blocked IPs</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {(s.blocked_ips ?? []).length === 0 && <p className="text-xs text-muted-foreground">No blocked IPs.</p>}
            {(s.blocked_ips ?? []).map((ip) => (
              <span key={ip} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-mono">
                {ip}
                <button onClick={() => unblock(ip)} className="text-muted-foreground hover:text-destructive" aria-label={`Unblock ${ip}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Spam keywords</span>
          <textarea
            value={(s.spam_keywords ?? []).join(", ")}
            onChange={(e) => setS({ ...s, spam_keywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
            rows={2}
            placeholder="e.g. casino, viagra, click here"
            className="mt-1 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary resize-none"
          />
          <span className="mt-1 block text-xs text-muted-foreground">Comma-separated. Comments containing any of these will appear in the Spam tab.</span>
        </div>

        <div className="pt-2">
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{save.isPending ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
      )}

      <PasswordSection />
    </div>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    if (next !== confirm) return toast.error("Passwords do not match");

    setBusy(true);
    try {
      const { data: ud } = await supabase.auth.getUser();
      const email = ud.user?.email;
      if (!email) throw new Error("Not signed in");

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: current });
      if (signInError) throw new Error("Current password is incorrect");

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;

      setCurrent(""); setNext(""); setConfirm("");
      toast.success("Password updated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="vault-card rounded-xl p-6 mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Change admin password</h2>
      </div>
      <Field type="password" label="Current password" value={current} onChange={setCurrent} />
      <Field type="password" label="New password" value={next} onChange={setNext} />
      <Field type="password" label="Confirm new password" value={confirm} onChange={setConfirm} />
      <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

type FieldProps = { label: string; value: string; onChange: (v: string) => void; type?: string };
function Field({ label, value, onChange, type = "text" }: FieldProps) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
