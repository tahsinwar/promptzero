import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/protected-route";
import { LayoutDashboard, FileText, Tags, FolderTree, MessageSquare, HelpCircle, Settings, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — Prompt Vault" }, { name: "robots", content: "noindex" }] }),
});

function AdminLayout() {
  return (
    <ProtectedRoute>
      <AdminShell />
    </ProtectedRoute>
  );
}

function AdminShell() {
  const { signOut } = useAuth();
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
        <button onClick={async () => { await signOut(); toast.success("Signed out"); }}
          className="mt-2 w-full inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>
      <main className="min-w-0"><Outlet /></main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, exact }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; exact?: boolean }) {
  return (
    <Link to={to} activeOptions={exact ? { exact: true } : undefined}
      activeProps={{ className: "bg-primary/15 text-primary" }}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
