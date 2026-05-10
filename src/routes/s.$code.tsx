import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/s/$code")({ component: ShortRedirect });

function ShortRedirect() {
  const { code } = Route.useParams();
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("prompts")
        .select("slug")
        .eq("short_code", code.toLowerCase())
        .maybeSingle();
      if (cancelled) return;
      if (data?.slug) nav({ to: "/p/$slug", params: { slug: data.slug }, replace: true });
      else nav({ to: "/", replace: true });
    })();
    return () => { cancelled = true; };
  }, [code, nav]);

  return (
    <div className="min-h-[40vh] grid place-items-center text-sm text-muted-foreground">
      Resolving link…
    </div>
  );
}