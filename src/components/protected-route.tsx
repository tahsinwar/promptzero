import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

export function ProtectedRoute({ children, requireAdmin = true }: { children: ReactNode; requireAdmin?: boolean }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="grid place-items-center min-h-[60vh] text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" search={{ redirect: window.location.pathname }} replace />;
  }
  if (requireAdmin && !isAdmin) {
    return (
      <div className="grid place-items-center min-h-[60vh] px-6">
        <div className="vault-card rounded-2xl p-8 max-w-md text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-destructive/15 ring-1 ring-destructive/30">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have permission to view this area. Contact an administrator if you believe this is a mistake.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}