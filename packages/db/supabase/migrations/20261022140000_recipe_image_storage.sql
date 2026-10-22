-- Public bucket for photos copied from a recipe's source page.
-- Objects are publicly readable. Household members may write only under their household folder.
-- The API uploads with the service role, which bypasses these policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists recipe_images_public_read on storage.objects;
create policy recipe_images_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'recipe-images');

drop policy if exists recipe_images_member_insert on storage.objects;
create policy recipe_images_member_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'recipe-images'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists recipe_images_member_update on storage.objects;
create policy recipe_images_member_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'recipe-images'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists recipe_images_member_delete on storage.objects;
create policy recipe_images_member_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );
