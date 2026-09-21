-- Public cook-import cache. Service role writes; API reads by id. Not mixed with catalog recipes.

create table public.recipe_imports (
  id uuid primary key default gen_random_uuid(),
  input_url text not null,
  canonical_url text not null unique,
  source_kind text,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  phase_label text not null default '',
  error_code text,
  error_message text,
  recipe jsonb,
  extraction_method text,
  provider text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_accessed_at timestamptz not null default now()
);

create index recipe_imports_status_idx on public.recipe_imports (status, updated_at);

create table public.recipe_import_rate (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

alter table public.recipe_imports enable row level security;
alter table public.recipe_import_rate enable row level security;
