-- INSERT ... RETURNING on stash_products failed because the select policy looked
-- the new row up by id via can_view_stash_product(). That helper is STABLE, so
-- it cannot see the row being inserted, and Postgres reports:
--   new row violates row-level security policy for table "stash_products"
-- Evaluate visibility on the new row's columns instead (same pattern as
-- 20260907160000_stash_list_insert_select.sql).

drop policy if exists stash_products_select on public.stash_products;

create policy stash_products_select on public.stash_products
  for select to authenticated
  using (
    public.is_household_member(household_id)
    and (
      public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
      or created_by = auth.uid()
      or exists (
        select 1
        from public.stash_list_products lp
        where lp.product_id = stash_products.id
          and public.can_view_stash_list(lp.list_id)
      )
    )
  );
