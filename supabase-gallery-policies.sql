-- Käivita see Supabase SQL Editoris.
-- Eesmärk: kasutaja saab muuta/kustutada ainult enda postitusi
-- tabelites public.trips, public.blog_posts, public.gallery_images.

grant usage on schema public to anon, authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.blog_posts add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.gallery_images add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.trips alter column user_id set not null;

create index if not exists idx_trips_user_id on public.trips(user_id);
create index if not exists idx_blog_posts_user_id on public.blog_posts(user_id);
create index if not exists idx_gallery_images_user_id on public.gallery_images(user_id);

alter table public.trips enable row level security;
alter table public.blog_posts enable row level security;
alter table public.gallery_images enable row level security;

grant select on table public.trips, public.blog_posts, public.gallery_images to anon, authenticated;
grant insert, update, delete on table public.trips, public.blog_posts, public.gallery_images to authenticated;

drop policy if exists "trips_select_all" on public.trips;
drop policy if exists "trips_insert_owner" on public.trips;
drop policy if exists "trips_update_owner" on public.trips;
drop policy if exists "trips_delete_owner" on public.trips;

create policy "trips_select_all"
on public.trips
for select
to anon, authenticated
using (true);

create policy "trips_insert_owner"
on public.trips
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "trips_update_owner"
on public.trips
for update
to authenticated
using (
	auth.uid() = user_id
	or exists (
		select 1 from public.user_roles ur
		where ur.user_id = auth.uid()
			and ur.role = 'moderator'
	)
)
with check (
	auth.uid() = user_id
	or exists (
		select 1 from public.user_roles ur
		where ur.user_id = auth.uid()
			and ur.role = 'moderator'
	)
);

create policy "trips_delete_owner"
on public.trips
for delete
to authenticated
using (
	auth.uid() = user_id
	or exists (
		select 1 from public.user_roles ur
		where ur.user_id = auth.uid()
			and ur.role = 'moderator'
	)
);

drop policy if exists "blog_select_all" on public.blog_posts;
drop policy if exists "blog_insert_owner" on public.blog_posts;
drop policy if exists "blog_update_owner" on public.blog_posts;
drop policy if exists "blog_delete_owner" on public.blog_posts;

create policy "blog_select_all"
on public.blog_posts
for select
to anon, authenticated
using (true);

create policy "blog_insert_owner"
on public.blog_posts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "blog_update_owner"
on public.blog_posts
for update
to authenticated
using (
	auth.uid() = user_id
	or exists (
		select 1 from public.user_roles ur
		where ur.user_id = auth.uid()
			and ur.role = 'moderator'
	)
)
with check (
	auth.uid() = user_id
	or exists (
		select 1 from public.user_roles ur
		where ur.user_id = auth.uid()
			and ur.role = 'moderator'
	)
);

create policy "blog_delete_owner"
on public.blog_posts
for delete
to authenticated
using (
	auth.uid() = user_id
	or exists (
		select 1 from public.user_roles ur
		where ur.user_id = auth.uid()
			and ur.role = 'moderator'
	)
);

drop policy if exists "gallery_select_all" on public.gallery_images;
drop policy if exists "gallery_insert_owner" on public.gallery_images;
drop policy if exists "gallery_update_owner" on public.gallery_images;
drop policy if exists "gallery_delete_owner" on public.gallery_images;

create policy "gallery_select_all"
on public.gallery_images
for select
to anon, authenticated
using (true);

create policy "gallery_insert_owner"
on public.gallery_images
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "gallery_update_owner"
on public.gallery_images
for update
to authenticated
using (
	auth.uid() = user_id
	or exists (
		select 1 from public.user_roles ur
		where ur.user_id = auth.uid()
			and ur.role = 'moderator'
	)
)
with check (
	auth.uid() = user_id
	or exists (
		select 1 from public.user_roles ur
		where ur.user_id = auth.uid()
			and ur.role = 'moderator'
	)
);

create policy "gallery_delete_owner"
on public.gallery_images
for delete
to authenticated
using (
	auth.uid() = user_id
	or exists (
		select 1 from public.user_roles ur
		where ur.user_id = auth.uid()
			and ur.role = 'moderator'
	)
);
