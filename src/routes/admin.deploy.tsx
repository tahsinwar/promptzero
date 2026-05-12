import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Rocket, GitBranch, GitCommit, ExternalLink, RefreshCw,
  CheckCircle2, XCircle, Clock, AlertCircle, Copy, Terminal,
} from "lucide-react";

const GITHUB_OWNER = "tahsinwar";
const GITHUB_REPO = "promptzero";
const LIVE_URL = "https://tanstack-start-app.tahsinwap.workers.dev";
const CUSTOM_URL = "https://promptzero.lovable.app";

export const Route = createFileRoute("/admin/deploy")({
  component: DeployDashboard,
  head: () => ({ meta: [{ title: "Deploy Status — Admin" }, { name: "robots", content: "noindex" }] }),
});

type Commit = {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  html_url: string;
  author?: { login: string; avatar_url: string } | null;
};

type WorkflowRun = {
  id: number;
  name: string;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | skipped | null
  html_url: string;
  created_at: string;
  updated_at: string;
  head_commit: { message: string } | null;
  head_branch: string;
  run_number: number;
};

function DeployDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(false);

  const commitsQuery = useQuery({
    queryKey: ["github-commits"],
    refetchInterval: autoRefresh ? 15_000 : false,
    queryFn: async (): Promise<Commit[]> => {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?per_page=10`,
      );
      if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
      return res.json();
    },
  });

  const runsQuery = useQuery({
    queryKey: ["github-runs"],
    refetchInterval: autoRefresh ? 15_000 : false,
    queryFn: async (): Promise<{ workflow_runs: WorkflowRun[] }> => {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs?per_page=10`,
      );
      if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
      return res.json();
    },
  });

  const refreshAll = () => {
    commitsQuery.refetch();
    runsQuery.refetch();
    toast.success("Refreshing status...");
  };

  const lastCommit = commitsQuery.data?.[0];
  const lastRun = runsQuery.data?.workflow_runs?.[0];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" /> Deploy Status
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor latest deployments, commits, and CI status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (15s)
          </label>
          <button
            onClick={refreshAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${commitsQuery.isFetching || runsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Live URLs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <LiveUrlCard label="Cloudflare Workers" url={LIVE_URL} />
        <LiveUrlCard label="Custom Domain" url={CUSTOM_URL} />
      </div>

      {/* Quick Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Last Deploy Status */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Last GitHub Actions Run
            </h3>
            <StatusBadge run={lastRun} />
          </div>
          {runsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : runsQuery.error ? (
            <div className="text-sm text-destructive">Failed to load</div>
          ) : !lastRun ? (
            <div className="text-sm text-muted-foreground">No runs yet</div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-medium truncate">
                #{lastRun.run_number} — {lastRun.head_commit?.message?.split("\n")[0] ?? lastRun.name}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />{lastRun.head_branch}</span>
                <span>{timeAgo(lastRun.updated_at)}</span>
              </div>
              <a
                href={lastRun.html_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View on GitHub <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        {/* Latest Commit */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Latest Commit
            </h3>
            <GitCommit className="h-4 w-4 text-muted-foreground" />
          </div>
          {commitsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : commitsQuery.error ? (
            <div className="text-sm text-destructive">Failed to load</div>
          ) : !lastCommit ? (
            <div className="text-sm text-muted-foreground">No commits</div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-medium line-clamp-2">
                {lastCommit.commit.message.split("\n")[0]}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <code className="px-1.5 py-0.5 rounded bg-muted font-mono">{lastCommit.sha.slice(0, 7)}</code>
                <span>{lastCommit.commit.author.name}</span>
                <span>{timeAgo(lastCommit.commit.author.date)}</span>
              </div>
              <a
                href={lastCommit.html_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View commit <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Manual Deploy Instructions */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Manual Deploy</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Run these commands locally, or double-click <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">deploy.bat</code> in the project folder.
        </p>
        <CodeBlock code={`git pull origin main\nnpm run deploy`} />
      </div>

      {/* Recent Workflow Runs */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent Workflow Runs</h3>
          <a
            href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            All runs <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="divide-y divide-border">
          {runsQuery.data?.workflow_runs?.slice(0, 8).map((run) => (
            <div key={run.id} className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors">
              <StatusIcon run={run} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {run.head_commit?.message?.split("\n")[0] ?? run.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>#{run.run_number}</span>
                  <span>•</span>
                  <span>{run.head_branch}</span>
                  <span>•</span>
                  <span>{timeAgo(run.updated_at)}</span>
                </div>
              </div>
              <a
                href={run.html_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
          {!runsQuery.data?.workflow_runs?.length && !runsQuery.isLoading && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No workflow runs yet
            </div>
          )}
          {runsQuery.isLoading && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Recent Commits */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent Commits</h3>
          <a
            href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/commits/main`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            All commits <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="divide-y divide-border">
          {commitsQuery.data?.slice(0, 8).map((c) => (
            <a
              key={c.sha}
              href={c.html_url}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors"
            >
              <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted shrink-0">{c.sha.slice(0, 7)}</code>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{c.commit.message.split("\n")[0]}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {c.commit.author.name} • {timeAgo(c.commit.author.date)}
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function LiveUrlCard({ label, url }: { label: string; url: string }) {
  const [status, setStatus] = useState<"unknown" | "checking" | "up" | "down">("unknown");

  const check = async () => {
    setStatus("checking");
    try {
      await fetch(url, { mode: "no-cors", cache: "no-store" });
      setStatus("up");
    } catch {
      setStatus("down");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <button
          onClick={check}
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            status === "up" ? "bg-green-500/15 text-green-600 dark:text-green-400" :
            status === "down" ? "bg-destructive/15 text-destructive" :
            status === "checking" ? "bg-muted text-muted-foreground" :
            "bg-muted text-muted-foreground hover:bg-secondary"
          }`}
        >
          {status === "checking" ? "Checking..." :
           status === "up" ? "● Live" :
           status === "down" ? "● Down" : "Check status"}
        </button>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1 break-all"
      >
        {url} <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    </div>
  );
}

function StatusBadge({ run }: { run?: WorkflowRun }) {
  if (!run) return null;
  const { status, conclusion } = run;
  if (status === "in_progress" || status === "queued") {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium">● Running</span>;
  }
  if (conclusion === "success") {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-medium">✓ Success</span>;
  }
  if (conclusion === "failure") {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">✕ Failed</span>;
  }
  if (conclusion === "cancelled") {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Cancelled</span>;
  }
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{conclusion ?? status}</span>;
}

function StatusIcon({ run }: { run: WorkflowRun }) {
  const { status, conclusion } = run;
  if (status === "in_progress" || status === "queued") {
    return <Clock className="h-4 w-4 text-blue-500 animate-pulse shrink-0" />;
  }
  if (conclusion === "success") {
    return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  }
  if (conclusion === "failure") {
    return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  }
  return <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function CodeBlock({ code }: { code: string }) {
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };
  return (
    <div className="relative group">
      <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto">{code}</pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}