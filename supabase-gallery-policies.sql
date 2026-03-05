-- Käivita see Supabase SQL Editoris, et galerii reeglid oleksid:
-- 1) Kõik saavad pilte lisada (anon/authenticated)
-- 2) Kõik saavad galeriid vaadata
-- 3) Keegi ei saa postitusi kustutada ega muuta

alter table public.gallery_posts enable row level security;

-- Vajalikud õigused anon/authenticated rollidele
grant usage on schema public to anon, authenticated;
grant select, insert on table public.gallery_posts to anon, authenticated;

-- Kui tabelis on identity/serial id, siis lisa ka sequence õigused
grant usage, select on all sequences in schema public to anon, authenticated;

-- Kustuta vanad policy'd, kui need eksisteerivad

drop policy if exists "gallery_select_all" on public.gallery_posts;
drop policy if exists "gallery_insert_all" on public.gallery_posts;
drop policy if exists "gallery_update_none" on public.gallery_posts;
drop policy if exists "gallery_delete_none" on public.gallery_posts;
drop policy if exists "Enable read access for all users" on public.gallery_posts;
drop policy if exists "Enable insert for all users" on public.gallery_posts;
drop policy if exists "Enable update for all users" on public.gallery_posts;
drop policy if exists "Enable delete for all users" on public.gallery_posts;

-- Read: lubatud kõigile
create policy "gallery_select_all"
on public.gallery_posts
for select
to anon, authenticated
using (true);

-- Insert: lubatud kõigile
create policy "gallery_insert_all"
on public.gallery_posts
for insert
to anon, authenticated
with check (true);

-- Update: keelatud kõigile
create policy "gallery_update_none"
on public.gallery_posts
for update
to anon, authenticated
using (false)
with check (false);

-- Delete: keelatud kõigile
create policy "gallery_delete_none"
on public.gallery_posts
for delete
to anon, authenticated
using (false);
