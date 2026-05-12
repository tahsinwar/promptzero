import type { PromptListItem } from "@/components/prompt-card";

export type PublicVaultSettings = {
  site_name?: string;
  tagline?: string;
  logo_url?: string;
  default_pin?: string;
  comment_auto_approve?: boolean;
};

export type PromptDetailPayload = {
  prompt: any;
  comments: any[];
  visitorQs: any[];
  versionCount: number;
  ratings: any[];
};

export type HomePayload = {
  settings: PublicVaultSettings;
  stats: { prompts: number; tools: number; copies: number };
  categories: any[];
  featured: PromptListItem[];
  prompts: PromptListItem[];
};

async function publicVaultFetch<T>(params: Record<string, string | undefined>) {
  const url = new URL("/api/public/vault", window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Public vault request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export function getPublicHome(params: {
  q?: string;
  ai?: string;
  cat?: string;
  diff?: string;
  sort?: string;
}) {
  return publicVaultFetch<HomePayload>({ mode: "home", ...params });
}

export function getPublicBrowse() {
  return publicVaultFetch<{ settings: PublicVaultSettings; categories: any[]; prompts: PromptListItem[] }>({ mode: "browse" });
}

export function getPublicSettings() {
  return publicVaultFetch<PublicVaultSettings>({ mode: "settings" });
}

export function getPublicPromptDetail(slug: string) {
  return publicVaultFetch<PromptDetailPayload | null>({ mode: "detail", slug });
}

export function getPublicRelated(promptId: string, tagIds: string[]) {
  return publicVaultFetch<any[]>({ mode: "related", promptId, tagIds: tagIds.join(",") });
}

export async function recordPublicPromptView(slug: string) {
  await fetch("/api/public/vault", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "increment_view", slug }),
  }).catch(() => undefined);
}

export async function recordPublicPromptCopy(id: string) {
  await fetch("/api/public/vault", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "increment_copy", id }),
  }).catch(() => undefined);
}

export async function recordPublicSubPromptCopy(id: string) {
  await fetch("/api/public/vault", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "increment_sub_copy", id }),
  }).catch(() => undefined);
}

export async function publicVaultPost<T = { ok: true }>(body: Record<string, unknown>) {
  const response = await fetch("/api/public/vault", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return (await response.json()) as T;
}