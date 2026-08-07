-- Storage setup for trip photos.
-- Run this once in Supabase: Dashboard -> SQL Editor -> paste -> Run.
-- (Same place you ran schema.sql.)

-- The bucket itself. Public read (so getPublicUrl() works and images just
-- load), but write access is locked down below to the signed-in owner only.
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', true)
on conflict (id) do nothing;

-- Anyone can view a photo via its URL (expected -- it's how <img> tags work).
create policy "public read"
on storage.objects for select
using (bucket_id = 'trip-photos');

-- Only the signed-in user can upload into their own folder. The app code
-- saves files as "<user-id>/<trip-id>-<timestamp>.<ext>", so checking the
-- first path segment against auth.uid() is what makes this safe.
create policy "own folder upload"
on storage.objects for insert
with check (bucket_id = 'trip-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own folder delete"
on storage.objects for delete
using (bucket_id = 'trip-photos' and (storage.foldername(name))[1] = auth.uid()::text);
