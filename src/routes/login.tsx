import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ShieldCheck, Vault } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — Prompt Vault" }, { name: "robots", content: "noindex" }] }),
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setBusy(false);
      setError(signInError?.message ?? "Invalid email or password.");
      return;
    }
    // Check admin role
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();

    setBusy(false);
    toast.success("Welcome back");
    if (roleRow) {
      navigate({ to: redirect && redirect.startsWith("/admin") ? redirect : "/admin" });
    } else {
      navigate({ to: redirect && !redirect.startsWith("/admin") ? redirect : "/" });
    }
  };

  return (
    <div className="grid place-items-center min-h-[80vh] px-6">
      <div className="w-full max-w-md vault-card rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <Vault className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Sign in</h1>
            <p className="text-xs text-muted-foreground">Access your Prompt Vault account</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-input/40 px-3.5 py-2.5 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Password</span>
            <input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-input/40 px-3.5 py-2.5 text-sm outline-none focus:border-primary" />
          </label>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
          )}

          <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back to home</Link>
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Secure</span>
        </div>
      </div>
    </div>
  );
}