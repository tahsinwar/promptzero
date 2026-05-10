import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { LayoutDashboard, FileText, Tags, FolderTree, MessageSquare, HelpCircle, Settings, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — Prompt Vault" }, { name: "robots", content: "noindex" }] }),
});

function AdminLayout() {
  const { user, loading } = useAuth();

  if (loading) return <div className="grid place-items-center min-h-[60vh] text-muted-foreground">Loading…</div>;
  if (!user) return <LoginCard />;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 grid lg:grid-cols-[220px_1fr] gap-8">
      <aside className="lg:sticky lg:top-24 lg:self-start vault-card rounded-xl p-3">
        <div className="px-3 py-2 mb-2 text-xs uppercase tracking-wider text-muted-foreground">Admin</div>
        <NavItem to="/admin" icon={LayoutDashboard} label="Dashboard" exact />
        <NavItem to="/admin/prompts" icon={FileText} label="Prompts" />
        <NavItem to="/admin/categories" icon={FolderTree} label="Categories" />
        <NavItem to="/admin/tags" icon={Tags} label="Tags" />
        <NavItem to="/admin/comments" icon={MessageSquare} label="Comments" />
        <NavItem to="/admin/questions" icon={HelpCircle} label="Q&A" />
        <NavItem to="/admin/settings" icon={Settings} label="Settings" />
        <button onClick={async () => { await supabase.auth.signOut(); toast.success("Signed out"); }}
          className="mt-2 w-full inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>
      <main className="min-w-0"><Outlet /></main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, exact }: { to: string; icon: any; label: string; exact?: boolean }) {
  return (
    <Link to={to} activeOptions={exact ? { exact: true } : undefined}
      activeProps={{ className: "bg-primary/15 text-primary" }}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function LoginCard() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const fn = mode === "signin"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
    const { error } = await fn;
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (mode === "signup") toast.success("Check your email to confirm your account.");
    else { toast.success("Welcome back"); router.invalidate(); }
  };

  return (
    <div className="grid place-items-center min-h-[70vh] px-6">
      <div className="w-full max-w-md vault-card rounded-2xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30"><ShieldCheck className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold">Admin access</h1>
            <p className="text-xs text-muted-foreground">Sign in to manage the vault</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            className="w-full rounded-lg border border-border bg-input/40 px-3.5 py-2.5 text-sm outline-none focus:border-primary" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
            className="w-full rounded-lg border border-border bg-input/40 px-3.5 py-2.5 text-sm outline-none focus:border-primary" />
          <button disabled={busy} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50">
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground">
          {mode === "signin" ? "First time? Create the admin account →" : "Already have an account? Sign in →"}
        </button>
      </div>
    </div>
  );
}
