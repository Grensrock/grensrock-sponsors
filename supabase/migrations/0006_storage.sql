-- Grensrock Sponsors — Stage 2 storage policies
--
-- Before running this file: go to Storage in the Supabase dashboard and
-- create two buckets, both set to PRIVATE (not public) —
--   sponsor-logos
--   example-images
-- Both stay private because access is controlled by the policies below, not
-- by a public URL. Objects are read/written via signed requests using the
-- caller's own session, exactly like every other table in this app.

create policy "sponsor-logos team read" on storage.objects for select
  using (bucket_id = 'sponsor-logos' and is_team());
create policy "sponsor-logos team write" on storage.objects for insert
  with check (bucket_id = 'sponsor-logos' and is_team());
create policy "sponsor-logos team update" on storage.objects for update
  using (bucket_id = 'sponsor-logos' and is_team());
create policy "sponsor-logos team delete" on storage.objects for delete
  using (bucket_id = 'sponsor-logos' and is_team());

-- Path convention: sponsor-logos/{sponsor_id}/logo.{ext}
create policy "sponsor-logos portal read own" on storage.objects for select
  using (bucket_id = 'sponsor-logos' and (storage.foldername(name))[1] = my_sponsor_id()::text);
create policy "sponsor-logos portal write own" on storage.objects for insert
  with check (bucket_id = 'sponsor-logos' and (storage.foldername(name))[1] = my_sponsor_id()::text);
create policy "sponsor-logos portal update own" on storage.objects for update
  using (bucket_id = 'sponsor-logos' and (storage.foldername(name))[1] = my_sponsor_id()::text);
create policy "sponsor-logos portal delete own" on storage.objects for delete
  using (bucket_id = 'sponsor-logos' and (storage.foldername(name))[1] = my_sponsor_id()::text);

-- example-images: team/admin manage; any authenticated session (team or sponsor) can read.
create policy "example-images admin write" on storage.objects for insert
  with check (bucket_id = 'example-images' and is_admin());
create policy "example-images admin update" on storage.objects for update
  using (bucket_id = 'example-images' and is_admin());
create policy "example-images admin delete" on storage.objects for delete
  using (bucket_id = 'example-images' and is_admin());
create policy "example-images authenticated read" on storage.objects for select
  using (bucket_id = 'example-images' and auth.role() = 'authenticated');
