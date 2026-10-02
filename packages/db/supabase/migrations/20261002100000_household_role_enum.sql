-- New household roles. Values are added in their own migration so the next
-- migration can use them after this transaction commits.

alter type public.household_role add value if not exists 'adult';
alter type public.household_role add value if not exists 'teen';
alter type public.household_role add value if not exists 'child';

notify pgrst, 'reload schema';
