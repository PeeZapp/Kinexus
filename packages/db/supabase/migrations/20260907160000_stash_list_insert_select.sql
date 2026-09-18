-- INSERT ... RETURNING on stash_lists failed because the select policy looked the
-- new row up by id. During that statement the nested select cannot see the row,
-- so PostgREST returned no representation and the client treated the save as failed.

drop policy if exists stash_lists_select on public.stash_lists;

create policy stash_lists_select on public.stash_lists
  for select to authenticated
  using (
    public.is_household_member(household_id)
    and (
      public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
      or created_by = auth.uid()
      or visibility = 'household'
      or (
        visibility = 'people'
        and exists (
          select 1
          from public.stash_list_people slp
          join public.household_people hp on hp.id = slp.person_id
          where slp.list_id = stash_lists.id
            and hp.user_id = auth.uid()
        )
      )
    )
  );
