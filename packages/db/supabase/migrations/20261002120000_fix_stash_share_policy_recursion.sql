-- Save and collection select policies queried their share-people tables under RLS.
-- Those tables' policies read the save or collection back, which Postgres rejects
-- as infinite recursion. The share checks already exist as security definer
-- functions, which bypass RLS and stop the loop.

drop policy if exists stash_links_select on public.stash_links;
create policy stash_links_select on public.stash_links
  for select to authenticated
  using (
    public.is_household_member(household_id)
    and (
      public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
      or created_by = auth.uid()
      or visibility = 'household'
      or (
        visibility = 'people'
        and public.link_shared_with_me(id)
      )
    )
  );

drop policy if exists stash_link_collections_select on public.stash_link_collections;
create policy stash_link_collections_select on public.stash_link_collections
  for select to authenticated
  using (
    public.is_household_member(household_id)
    and (
      public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
      or created_by = auth.uid()
      or visibility = 'household'
      or (
        visibility = 'people'
        and public.collection_shared_with_me(id)
      )
    )
  );

notify pgrst, 'reload schema';
