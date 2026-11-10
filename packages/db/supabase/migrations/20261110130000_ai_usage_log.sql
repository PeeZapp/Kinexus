-- 17b: AI usage log + billing class placeholder + vault read/status helpers for BYOK routing.

create type public.ai_billing_class as enum ('standard', 'byok_discounted');

alter table public.households
  add column if not exists ai_billing_class public.ai_billing_class not null default 'standard';

create type public.ai_usage_status as enum (
  'ok',
  'error',
  'blocked_no_access',
  'blocked_paused'
);

create type public.ai_key_source as enum ('household', 'platform');

create table public.ai_usage_log (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null,
  provider public.ai_provider,
  key_source public.ai_key_source,
  model text,
  input_tokens integer,
  output_tokens integer,
  web_search_used boolean not null default false,
  status public.ai_usage_status not null,
  created_at timestamptz not null default now()
);

create index ai_usage_log_household_created_idx
  on public.ai_usage_log (household_id, created_at desc);

create index ai_usage_log_user_created_idx
  on public.ai_usage_log (user_id, created_at desc);

alter table public.ai_usage_log enable row level security;

grant select on table public.ai_usage_log to authenticated;
-- Writes only via service role (no insert/update/delete grants to authenticated).

create policy ai_usage_log_select_own on public.ai_usage_log
  for select to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id));

create policy ai_usage_log_select_admin on public.ai_usage_log
  for select to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

-- Recipe import needs caller context across async work kicks.
alter table public.recipe_imports
  add column if not exists request_user_id uuid,
  add column if not exists request_household_id uuid,
  add column if not exists ai_blocked text
    check (ai_blocked is null or ai_blocked in ('no_access', 'key_paused'));

create or replace function public.internal_get_household_ai_key_material(
  p_household_id uuid
)
returns table (
  provider public.ai_provider,
  key_status public.ai_key_status,
  secret text
)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
  select
    k.provider,
    k.key_status,
    d.decrypted_secret
  from public.household_ai_keys k
  join vault.decrypted_secrets d on d.id = k.vault_secret_id
  where k.household_id = p_household_id;
end;
$$;

revoke all on function public.internal_get_household_ai_key_material(uuid) from public;
grant execute on function public.internal_get_household_ai_key_material(uuid) to service_role;

create or replace function public.internal_set_household_ai_key_status(
  p_household_id uuid,
  p_key_status public.ai_key_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.household_ai_keys
  set key_status = p_key_status,
      last_checked_at = now(),
      updated_at = now()
  where household_id = p_household_id;
end;
$$;

revoke all on function public.internal_set_household_ai_key_status(uuid, public.ai_key_status) from public;
grant execute on function public.internal_set_household_ai_key_status(uuid, public.ai_key_status) to service_role;

create or replace function public.internal_insert_ai_usage_log(
  p_household_id uuid,
  p_user_id uuid,
  p_feature text,
  p_provider public.ai_provider,
  p_key_source public.ai_key_source,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_web_search_used boolean,
  p_status public.ai_usage_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_usage_log (
    household_id, user_id, feature, provider, key_source, model,
    input_tokens, output_tokens, web_search_used, status, created_at
  ) values (
    p_household_id, p_user_id, p_feature, p_provider, p_key_source, p_model,
    p_input_tokens, p_output_tokens, coalesce(p_web_search_used, false), p_status, now()
  );
end;
$$;

revoke all on function public.internal_insert_ai_usage_log(
  uuid, uuid, text, public.ai_provider, public.ai_key_source, text, integer, integer, boolean, public.ai_usage_status
) from public;
grant execute on function public.internal_insert_ai_usage_log(
  uuid, uuid, text, public.ai_provider, public.ai_key_source, text, integer, integer, boolean, public.ai_usage_status
) to service_role;
