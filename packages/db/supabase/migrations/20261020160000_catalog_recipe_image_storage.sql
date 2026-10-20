-- Public bucket for catalog recipe photos uploaded by catalog editors.
-- Objects are publicly readable; only catalog editors may write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-recipe-images',
  'catalog-recipe-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists catalog_recipe_images_public_read on storage.objects;
create policy catalog_recipe_images_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'catalog-recipe-images');

drop policy if exists catalog_recipe_images_editor_insert on storage.objects;
create policy catalog_recipe_images_editor_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'catalog-recipe-images'
    and public.is_catalog_editor()
  );

drop policy if exists catalog_recipe_images_editor_update on storage.objects;
create policy catalog_recipe_images_editor_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'catalog-recipe-images'
    and public.is_catalog_editor()
  )
  with check (
    bucket_id = 'catalog-recipe-images'
    and public.is_catalog_editor()
  );

drop policy if exists catalog_recipe_images_editor_delete on storage.objects;
create policy catalog_recipe_images_editor_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'catalog-recipe-images'
    and public.is_catalog_editor()
  );
