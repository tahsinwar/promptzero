import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Vault, Search, Sun, Moon, ShieldCheck, Sparkles, Bookmark } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

type Settings = { site_name?: string; tagline?: string; logo_url?: string };

function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("settings").eq("id", 1).maybeSingle();
      return (data?.settings ?? {}) as Settings;
    },
    staleTime: 60_000,
  });
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-180px)]">{children}</main>
      <Footer />
    </>
  );
}

function Navbar() {
  const { isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const { data: settings } = useSiteSettings();
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const siteName = settings?.site_name || "Prompt Vault";
  const logoUrl = settings?.logo_url;

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate({ to: "/", search: q.trim() ? { q: q.trim() } : {} });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/30 group-hover:shadow-glow transition-shadow">
              <Vault className="h-5 w-5 text-primary" />
            </div>
          )}
          <span className="font-bold text-lg tracking-tight hidden sm:inline">{siteName}</span>
        </Link>

        <form onSubmit={onSearch} className="flex-1 max-w-xl mx-2">
          <label className="relative block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts…"
              className="w-full rounded-lg border border-border bg-card/60 pl-10 pr-3 py-2 text-sm outline-none focus:border-primary transition-colors" />
          </label>
        </form>

        <nav className="flex items-center gap-1 text-sm">
          <Link to="/saved" activeProps={{ className: "text-foreground" }} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground transition-colors">
            <Bookmark className="h-4 w-4" /> Saved
          </Link>
          <button onClick={toggle} aria-label="Toggle theme"
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {isAdmin && (
            <Link to="/admin" className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const { data: settings } = useSiteSettings();
  const siteName = settings?.site_name || "Prompt Vault";
  return (
    <footer className="mt-32 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>{siteName}</span>
        </div>
        <span>© {new Date().getFullYear()} {siteName}. All rights reserved.</span>
      </div>
    </footer>
  );
}