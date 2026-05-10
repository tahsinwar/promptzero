import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, MessageSquare, HelpCircle, Eye, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [a, b, c, d] = await Promise.all([
        supabase.from("prompts").select("*", { count: "exact", head: true }),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("is_approved", false),
        supabase.from("visitor_questions").select("*", { count: "exact", head: true }).is("answer", null),
        supabase.from("prompts").select("view_count"),
      ]);
      const views = (d.data ?? []).reduce((s: number, r: any) => s + (r.view_count ?? 0), 0);
      return { prompts: a.count ?? 0, pending: b.count ?? 0, qs: c.count ?? 0, views };
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome back to the vault.</p>
        </div>
        <Link to="/admin/prompts" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> New prompt
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileText} label="Total prompts" value={data?.prompts ?? 0} />
        <Stat icon={Eye} label="Total views" value={data?.views ?? 0} />
        <Stat icon={MessageSquare} label="Pending comments" value={data?.pending ?? 0} accent />
        <Stat icon={HelpCircle} label="Open questions" value={data?.qs ?? 0} accent />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: any) {
  return (
    <div className="vault-card rounded-xl p-5">
      <Icon className={`h-5 w-5 ${accent ? "text-accent" : "text-primary"} mb-3`} />
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
