import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Vault, Search, Sun, Moon, ShieldCheck, Sparkles, Bookmark, Github, Twitter, Linkedin, Mail, Heart } from "lucide-react";
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
    staleTime: 10 * 60 * 1000,
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
  const tagline = settings?.tagline || "Best AI Prompts Collection";
  const year = new Date().getFullYear();
  return (
    <footer className="mt-32 relative overflow-hidden border-t border-border/50 bg-gradient-to-b from-background via-background to-primary/[0.03]">
      {/* Decorative glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/2 -translate-x-1/2 h-64 w-[80%] rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-14">
        {/* Top — Brand + Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10">
          {/* Brand */}
          <div className="space-y-3">
            <Link to="/" className="inline-flex items-center gap-2 group">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/30 group-hover:shadow-glow transition-shadow">
                <Vault className="h-5 w-5 text-primary" />
              </div>
              <span className="font-bold text-lg tracking-tight">{siteName}</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{tagline}</p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/80 mb-3">Explore</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-muted-foreground hover:text-primary transition-colors">All Prompts</Link></li>
              <li><Link to="/browse" className="text-muted-foreground hover:text-primary transition-colors">Browse Categories</Link></li>
              <li><Link to="/saved" className="text-muted-foreground hover:text-primary transition-colors">Saved Prompts</Link></li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/80 mb-3">Connect</h4>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/tahsinwar"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Twitter"
                className="grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="mailto:hello@promptzero.com"
                aria-label="Email"
                className="grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Bottom — Copyright + Designer credit */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>© {year} {siteName}. All rights reserved.</span>
          </div>

          {/* Designer credit */}
          <div className="flex items-center gap-1.5">
            <span>Designed &amp; built with</span>
            <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500 animate-pulse" />
            <span>by</span>
            <a
              href="https://github.com/tahsinwar"
              target="_blank"
              rel="noreferrer"
              className="font-semibold bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent hover:underline decoration-primary/40 underline-offset-4 transition-all"
            >
              Nazmus Shakib Tahsin
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}