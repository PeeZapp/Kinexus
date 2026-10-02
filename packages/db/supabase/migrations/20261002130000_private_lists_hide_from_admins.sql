-- Private lists, saves, and watchlists stay hidden from household admins.
-- The household owner and the person who created the list can still see them.

create or replace function public.can_view_shared(
  _household_id uuid,
  _created_by uuid,
  _visibility text,
  _shared boolean
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_household_member(_household_id)
    and (
      public.household_role_of(_household_id) = 'owner'
      or _created_by is not distinct from auth.uid()
      or (
        _visibility is distinct from 'private'
        and public.household_role_of(_household_id) = 'admin'
      )
      or _visibility = 'household'
      or (_visibility = 'people' and _shared)
    );
$$;

create or replace function public.can_edit_shared(
  _household_id uuid,
  _created_by uuid,
  _visibility text,
  _shared boolean,
  _teen_edits_household boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when _visibility = 'private'
      and _created_by is distinct from auth.uid()
      and public.household_role_of(_household_id) is distinct from 'owner'
      then false
    else case public.household_role_of(_household_id)
      when 'owner' then true
      when 'admin' then true
      when 'adult' then public.can_view_shared(_household_id, _created_by, _visibility, _shared)
      when 'teen' then
        _created_by is not distinct from auth.uid()
        or (_teen_edits_household and _visibility = 'household')
      else false
    end
  end;
$$;

drop policy if exists stash_lists_select on public.stash_lists;
create policy stash_lists_select on public.stash_lists
  for select to authenticated
  using (
    public.can_view_shared(
      household_id,
      created_by,
      visibility,
      public.stash_list_shared_with_me(id)
    )
  );

drop policy if exists stash_links_select on public.stash_links;
create policy stash_links_select on public.stash_links
  for select to authenticated
  using (
    public.can_view_shared(
      household_id,
      created_by,
      visibility,
      public.link_shared_with_me(id)
    )
  );

drop policy if exists stash_link_collections_select on public.stash_link_collections;
create policy stash_link_collections_select on public.stash_link_collections
  for select to authenticated
  using (
    public.can_view_shared(
      household_id,
      created_by,
      visibility,
      public.collection_shared_with_me(id)
    )
  );

notify pgrst, 'reload schema';
