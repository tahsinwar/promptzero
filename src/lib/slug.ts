export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80) || `item-${Date.now()}`;
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem("pv_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("pv_session", id);
  }
  return id;
}
