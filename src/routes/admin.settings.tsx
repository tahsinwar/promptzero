import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: Settings });

function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await supabase.from("admin_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [s, setS] = useState<any>({});
  useEffect(() => { if (data?.settings) setS(data.settings); }, [data]);

  const save = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("admin_settings").update({ settings: s }).eq("id", 1); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-settings"] }); toast.success("Settings saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <div className="vault-card rounded-xl p-6 space-y-4 max-w-xl">
        <Field label="Site name" value={s.site_name} onChange={(v) => setS({ ...s, site_name: v })} />
        <Field label="Tagline" value={s.tagline} onChange={(v) => setS({ ...s, tagline: v })} />
        <Field label="Logo URL" value={s.logo_url} onChange={(v) => setS({ ...s, logo_url: v })} />
        <Field label="Default PIN" value={s.default_pin} onChange={(v) => setS({ ...s, default_pin: v })} />
        <Field label="Auto-lock minutes" type="number" value={s.auto_lock_minutes} onChange={(v) => setS({ ...s, auto_lock_minutes: Number(v) })} />
        <Field label="Accent color" type="color" value={s.accent_color} onChange={(v) => setS({ ...s, accent_color: v })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!s.comment_auto_approve} onChange={(e) => setS({ ...s, comment_auto_approve: e.target.checked })} />
          Auto-approve comments
        </label>
        <button onClick={() => save.mutate()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
          <Save className="h-4 w-4" /> Save settings
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: any) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary ${type === "color" ? "h-11 cursor-pointer" : ""}`} />
    </label>
  );
}
