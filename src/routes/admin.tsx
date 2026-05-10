import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/protected-route";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, FileText, FolderTree, MessageSquare, Settings,
  LogOut, Bell, Menu, X,
} from "lucide-react";
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

function usePendingCount() {
  return useQuery({
    queryKey: ["admin-pending-comments"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase.from("comments").select("*", { count: "exact", head: true }).eq("is_approved", false);
      return count ?? 0;
    },
  });
}

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/prompts", label: "Prompts", icon: FileText },
  { to: "/admin/categories", label: "Categories & Tags", icon: FolderTree },
  { to: "/admin/comments", label: "Comments & Questions", icon: MessageSquare, badge: "pending" as const },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminShell() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { data: pending = 0 } = usePendingCount();

  const current = NAV.find((n) => (n.exact ? path === n.to : path.startsWith(n.to)));
  const title = current?.label ?? "Admin";

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside className={`${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:sticky lg:top-0 left-0 top-0 z-40 h-screen w-64 bg-card border-r border-border transition-transform`}>
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          <Link to="/" className="text-sm font-bold tracking-tight">Prompt Vault</Link>
          <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
        </div>
        <nav className="p-3 space-y-0.5">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Admin</div>
          {NAV.map((n) => {
            const active = n.exact ? path === n.to : path.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}>
                <Icon className="h-4 w-4" /> <span className="flex-1">{n.label}</span>
                {n.badge === "pending" && pending > 0 && (
                  <span className="rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px] text-center">{pending}</span>
                )}
              </Link>
            );
          })}
          <button onClick={async () => { await signOut(); toast.success("Signed out"); }}
            className="mt-2 w-full inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </nav>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-background/60 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20 flex items-center px-4 gap-3">
          <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <h1 className="text-sm font-semibold flex-1 truncate">{title}</h1>
          <button
            onClick={() => navigate({ to: "/admin/comments", search: { filter: "pending" } as any })}
            className="relative grid h-9 w-9 place-items-center rounded-md hover:bg-secondary"
            aria-label="Pending comments"
          >
            <Bell className="h-4 w-4" />
            {pending > 0 && (
              <span className="absolute top-0.5 right-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold px-1 min-w-[16px] text-center">{pending}</span>
            )}
          </button>
          <button onClick={async () => { await signOut(); toast.success("Signed out"); }}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </header>

        <main className="flex-1 p-6 min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}
