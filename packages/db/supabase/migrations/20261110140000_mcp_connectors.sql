-- 18a: AI chat connectors foundation (MCP connections, write previews, audit).
-- OAuth tokens live in Supabase Auth (AS); we only track connections + tool audit here.

create type public.mcp_platform as enum (
  'chatgpt',
  'claude',
  'perplexity',
  'inspector',
  'other'
);

create type public.mcp_audit_mode as enum ('read', 'write');

create table public.mcp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id text not null,
  client_name text,
  platform public.mcp_platform not null default 'other',
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, client_id)
);

create index mcp_connections_user_idx on public.mcp_connections (user_id, created_at desc);
create index mcp_connections_client_idx on public.mcp_connections (client_id);

create table public.mcp_previews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  client_id text,
  tool text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  committed_at timestamptz
);

create index mcp_previews_user_idx on public.mcp_previews (user_id, created_at desc);
create index mcp_previews_expires_idx on public.mcp_previews (expires_at)
  where committed_at is null;

create table public.mcp_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  client_id text,
  platform public.mcp_platform,
  tool text not null,
  mode public.mcp_audit_mode not null,
  success boolean not null,
  error_kind text,
  affected_ids text[] not null default '{}'
);

create index mcp_audit_log_user_idx on public.mcp_audit_log (user_id, at desc);
create index mcp_audit_log_household_idx on public.mcp_audit_log (household_id, at desc);

alter table public.mcp_connections enable row level security;
alter table public.mcp_previews enable row level security;
alter table public.mcp_audit_log enable row level security;

grant select, insert, update on table public.mcp_connections to authenticated;
grant select, insert, update on table public.mcp_previews to authenticated;
grant select, insert on table public.mcp_audit_log to authenticated;

-- Users read their own rows; no client deletes. Updates limited to own rows (revoke / last_used / commit).
create policy mcp_connections_select_own on public.mcp_connections
  for select to authenticated
  using (user_id = auth.uid());

create policy mcp_connections_insert_own on public.mcp_connections
  for insert to authenticated
  with check (user_id = auth.uid());

create policy mcp_connections_update_own on public.mcp_connections
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy mcp_previews_select_own on public.mcp_previews
  for select to authenticated
  using (user_id = auth.uid());

create policy mcp_previews_insert_own on public.mcp_previews
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy mcp_previews_update_own on public.mcp_previews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy mcp_audit_log_select_own on public.mcp_audit_log
  for select to authenticated
  using (user_id = auth.uid());

create policy mcp_audit_log_insert_own on public.mcp_audit_log
  for insert to authenticated
  with check (user_id = auth.uid());
