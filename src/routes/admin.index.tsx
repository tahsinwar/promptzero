import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, CheckCircle, Copy, Eye, MessageSquare, HelpCircle,
  Plus, Edit3, MessageCircle, Clock,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [total, published, sums, pending, qs] = await Promise.all([
        supabase.from("prompts").select("*", { count: "exact", head: true }),
        supabase.from("prompts").select("*", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("prompts").select("view_count, copy_count"),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("is_approved", false),
        supabase.from("visitor_questions").select("*", { count: "exact", head: true }).is("answer", null),
      ]);
      const rows = (sums.data ?? []) as Array<{ view_count: number | null; copy_count: number | null }>;
      const views = rows.reduce((s, r) => s + (r.view_count ?? 0), 0);
      const copies = rows.reduce((s, r) => s + (r.copy_count ?? 0), 0);
      return {
        total: total.count ?? 0,
        published: published.count ?? 0,
        views, copies,
        pending: pending.count ?? 0,
        questions: qs.count ?? 0,
      };
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["admin-activity"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [prompts, comments] = await Promise.all([
        supabase.from("prompts").select("id,slug,title,updated_at").order("updated_at", { ascending: false }).limit(5),
        supabase.from("comments").select("id,prompt_id,author_name,created_at,prompts(title,slug)").order("created_at", { ascending: false }).limit(5),
      ]);
      const items: any[] = [];
      (prompts.data ?? []).forEach((p) => items.push({ type: "prompt", time: p.updated_at, title: p.title, slug: p.slug }));
      (comments.data ?? []).forEach((c: any) => items.push({ type: "comment", time: c.created_at, title: c.prompts?.title ?? "—", slug: c.prompts?.slug, author: c.author_name }));
      return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome back to the vault.</p>
        </div>
        <Link to="/admin/prompts" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> New prompt
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={FileText} label="Total prompts" value={stats?.total ?? 0} />
        <Stat icon={CheckCircle} label="Published" value={stats?.published ?? 0} />
        <Stat icon={Copy} label="Total copies" value={stats?.copies ?? 0} />
        <Stat icon={Eye} label="Total views" value={stats?.views ?? 0} />
        <Stat icon={MessageSquare} label="Pending comments" value={stats?.pending ?? 0} accent />
        <Stat icon={HelpCircle} label="Pending questions" value={stats?.questions ?? 0} accent />
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent activity</h2>
        <div className="vault-card rounded-xl divide-y divide-border">
          {activity.length === 0 && <div className="p-4 text-sm text-muted-foreground">No recent activity yet.</div>}
          {activity.map((it, i) => (
            <ActivityRow key={i} item={it} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: any) {
  return (
    <div className="vault-card rounded-xl p-5">
      <Icon className={`h-5 w-5 ${accent ? "text-accent" : "text-primary"} mb-3`} />
      <div className="text-3xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function ActivityRow({ item }: { item: any }) {
  const isPrompt = item.type === "prompt";
  const Icon = isPrompt ? Edit3 : MessageCircle;
  const text = isPrompt ? <>Prompt updated: <span className="font-medium">{item.title}</span></> : <><span className="font-medium">{item.author}</span> commented on <span className="font-medium">{item.title}</span></>;
  return (
    <div className="flex items-center gap-3 p-3.5">
      <div className={`grid h-8 w-8 place-items-center rounded-md ${isPrompt ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 text-sm truncate">{text}</div>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {timeAgo(item.time)}</span>
    </div>
  );
}
