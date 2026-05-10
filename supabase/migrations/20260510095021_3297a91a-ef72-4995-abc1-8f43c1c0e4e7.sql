-- =========================
-- TABLES
-- =========================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  color text default '#6366f1',
  created_at timestamptz default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  content text not null,
  notes text,
  category_id uuid references public.categories(id) on delete set null,
  ai_models text[] default '{}',
  difficulty text check (difficulty in ('beginner','intermediate','advanced')),
  pin_hash text,
  is_locked boolean default false,
  auto_lock_minutes int default 0,
  is_published boolean default true,
  is_featured boolean default false,
  view_count int default 0,
  copy_count int default 0,
  rating_avg numeric default 0,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.prompt_tags (
  prompt_id uuid references public.prompts(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (prompt_id, tag_id)
);

create table public.prompt_videos (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references public.prompts(id) on delete cascade,
  youtube_url text not null,
  title text,
  display_order int default 0
);

create table public.prompt_links (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references public.prompts(id) on delete cascade,
  title text not null,
  url text not null,
  link_type text default 'website',
  description text,
  display_order int default 0
);

create table public.prompt_qa (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references public.prompts(id) on delete cascade,
  question text not null,
  answer text not null,
  display_order int default 0
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references public.prompts(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_name text not null,
  content text not null,
  is_approved boolean default false,
  is_pinned boolean default false,
  upvotes int default 0,
  ip_address text,
  created_at timestamptz default now()
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references public.prompts(id) on delete cascade,
  value int check (value in (1, -1)),
  session_id text not null,
  created_at timestamptz default now(),
  unique(prompt_id, session_id)
);

create table public.visitor_questions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references public.prompts(id) on delete cascade,
  author_name text not null,
  question text not null,
  answer text,
  is_published boolean default false,
  created_at timestamptz default now()
);

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references public.prompts(id) on delete cascade,
  content text not null,
  change_note text,
  changed_at timestamptz default now()
);

create table public.admin_settings (
  id int primary key default 1,
  settings jsonb default '{
    "site_name": "Prompt Vault",
    "tagline": "Best AI Prompts Collection",
    "logo_url": "",
    "default_pin": "00000",
    "auto_lock_minutes": 30,
    "comment_auto_approve": false,
    "accent_color": "#6366f1",
    "blocked_ips": []
  }'::jsonb
);

insert into public.admin_settings (id) values (1) on conflict do nothing;

-- =========================
-- INDEXES
-- =========================
create index on public.prompts (category_id);
create index on public.prompts (is_published, is_featured);
create index on public.comments (prompt_id);
create index on public.ratings (prompt_id);

-- =========================
-- TIMESTAMP TRIGGER
-- =========================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger prompts_set_updated_at
before update on public.prompts
for each row execute function public.tg_set_updated_at();

-- =========================
-- RPCs
-- =========================
create or replace function public.increment_view_count(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin update public.prompts set view_count = view_count + 1 where slug = p_slug; end; $$;

create or replace function public.increment_copy_count(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin update public.prompts set copy_count = copy_count + 1 where id = p_id; end; $$;

create or replace function public.increment_comment_upvote(c_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin update public.comments set upvotes = upvotes + 1 where id = c_id; end; $$;

-- =========================
-- ROW LEVEL SECURITY
-- =========================
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.prompts enable row level security;
alter table public.prompt_tags enable row level security;
alter table public.prompt_videos enable row level security;
alter table public.prompt_links enable row level security;
alter table public.prompt_qa enable row level security;
alter table public.comments enable row level security;
alter table public.ratings enable row level security;
alter table public.visitor_questions enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.admin_settings enable row level security;

-- Public read
create policy "public read categories" on public.categories for select using (true);
create policy "public read tags" on public.tags for select using (true);
create policy "public read published prompts" on public.prompts for select using (is_published = true);
create policy "public read prompt_tags" on public.prompt_tags for select using (true);
create policy "public read prompt_videos" on public.prompt_videos for select using (true);
create policy "public read prompt_links" on public.prompt_links for select using (true);
create policy "public read prompt_qa" on public.prompt_qa for select using (true);
create policy "public read approved comments" on public.comments for select using (is_approved = true);
create policy "public read ratings" on public.ratings for select using (true);
create policy "public read published visitor_questions" on public.visitor_questions for select using (is_published = true);
create policy "public read admin_settings" on public.admin_settings for select using (true);

-- Public submission
create policy "anyone can submit comments" on public.comments for insert with check (true);
create policy "anyone can submit ratings" on public.ratings for insert with check (true);
create policy "anyone can update own session rating" on public.ratings for update using (true) with check (true);
create policy "anyone can submit visitor_questions" on public.visitor_questions for insert with check (true);

-- Admin full access (any authenticated user)
create policy "admin all categories" on public.categories for all to authenticated using (true) with check (true);
create policy "admin all tags" on public.tags for all to authenticated using (true) with check (true);
create policy "admin all prompts" on public.prompts for all to authenticated using (true) with check (true);
create policy "admin all prompt_tags" on public.prompt_tags for all to authenticated using (true) with check (true);
create policy "admin all prompt_videos" on public.prompt_videos for all to authenticated using (true) with check (true);
create policy "admin all prompt_links" on public.prompt_links for all to authenticated using (true) with check (true);
create policy "admin all prompt_qa" on public.prompt_qa for all to authenticated using (true) with check (true);
create policy "admin all comments" on public.comments for all to authenticated using (true) with check (true);
create policy "admin all ratings" on public.ratings for all to authenticated using (true) with check (true);
create policy "admin all visitor_questions" on public.visitor_questions for all to authenticated using (true) with check (true);
create policy "admin all prompt_versions" on public.prompt_versions for all to authenticated using (true) with check (true);
create policy "admin all admin_settings" on public.admin_settings for all to authenticated using (true) with check (true);
create policy "admin read all prompts" on public.prompts for select to authenticated using (true);
create policy "admin read all comments" on public.comments for select to authenticated using (true);
create policy "admin read all visitor_questions" on public.visitor_questions for select to authenticated using (true);
create policy "public read prompt_versions" on public.prompt_versions for select using (true);