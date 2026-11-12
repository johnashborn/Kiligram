-- ------------------------------------------------------------------
-- Our Little Memories: database + storage setup for Supabase.
-- Paste into Supabase > SQL Editor and run. Safe to run more than once
-- (it also replaces the older, looser rules from earlier versions).
--
-- Who can do what: ONLY the accounts listed in public.members (the two of you)
--   * see the photos, the photo files and the letters
--   * add, edit and delete photos
--   * write letters, and edit or delete their own
-- Nobody else, logged in or not, can read or change anything.
--
-- Also: Authentication > Sign In / Providers > turn OFF "Allow new users to sign up".
-- ------------------------------------------------------------------


-- ---------- Members: the two accounts allowed in ----------
create table if not exists public.members (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
-- No policies on purpose: nobody can read or change this list from the website.
-- Only the SQL Editor (and the is_member() check below) can see it.
alter table public.members enable row level security;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to anon, authenticated;

-- ADD THE TWO OF YOU: put your real emails in place of the examples, then run
-- this line (again after creating a new account). Keep real emails out of this file.
insert into public.members (user_id)
select id from auth.users
where lower(email) in ('your-email@example.com', 'her-email@example.com')
on conflict do nothing;


-- ---------- Photos ----------
create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  image_path  text not null,                -- file name inside the "photos" bucket
  caption     text not null default '',
  month_label text,                         -- e.g. "Month 3"; groups photos on the gallery
  taken_on    date,
  tilt        real not null default 0,      -- polaroid tilt in degrees (-4 .. 4)
  created_at  timestamptz not null default now()
);

alter table public.photos enable row level security;

-- old, looser rules from earlier versions
drop policy if exists "Anyone can view photos" on public.photos;
drop policy if exists "Admin can add photos" on public.photos;
drop policy if exists "Admin can edit photos" on public.photos;
drop policy if exists "Admin can delete photos" on public.photos;

drop policy if exists "Members can view photos" on public.photos;
create policy "Members can view photos"
  on public.photos for select to authenticated using (public.is_member());

drop policy if exists "Members can add photos" on public.photos;
create policy "Members can add photos"
  on public.photos for insert to authenticated with check (public.is_member());

drop policy if exists "Members can edit photos" on public.photos;
create policy "Members can edit photos"
  on public.photos for update to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "Members can delete photos" on public.photos;
create policy "Members can delete photos"
  on public.photos for delete to authenticated using (public.is_member());


-- ---------- Photo files: a PRIVATE bucket ----------
-- The website loads each photo through a short-lived signed link made for a member.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do update set public = false;

-- old, looser rules from earlier versions
drop policy if exists "Admin can upload photos" on storage.objects;
drop policy if exists "Admin can replace photos" on storage.objects;
drop policy if exists "Admin can delete photo files" on storage.objects;

drop policy if exists "Members can view photo files" on storage.objects;
create policy "Members can view photo files"
  on storage.objects for select to authenticated using (bucket_id = 'photos' and public.is_member());

drop policy if exists "Members can upload photo files" on storage.objects;
create policy "Members can upload photo files"
  on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_member());

drop policy if exists "Members can replace photo files" on storage.objects;
create policy "Members can replace photo files"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_member())
  with check (bucket_id = 'photos' and public.is_member());

drop policy if exists "Members can delete photo files" on storage.objects;
create policy "Members can delete photo files"
  on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_member());


-- ---------- Letters to each other ----------
create table if not exists public.letters (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null,
  body        text not null check (char_length(body) between 1 and 5000),
  created_at  timestamptz not null default now()
);

alter table public.letters enable row level security;

-- old, looser rules from earlier versions
drop policy if exists "Signed-in users can read letters" on public.letters;
drop policy if exists "Write letters as yourself" on public.letters;
drop policy if exists "Edit your own letters" on public.letters;
drop policy if exists "Delete your own letters" on public.letters;

drop policy if exists "Members can read letters" on public.letters;
create policy "Members can read letters"
  on public.letters for select to authenticated using (public.is_member());

drop policy if exists "Members write letters as themselves" on public.letters;
create policy "Members write letters as themselves"
  on public.letters for insert to authenticated
  with check (public.is_member() and author_id = auth.uid());

drop policy if exists "Members edit their own letters" on public.letters;
create policy "Members edit their own letters"
  on public.letters for update to authenticated
  using (public.is_member() and author_id = auth.uid())
  with check (public.is_member() and author_id = auth.uid());

drop policy if exists "Members delete their own letters" on public.letters;
create policy "Members delete their own letters"
  on public.letters for delete to authenticated
  using (public.is_member() and author_id = auth.uid());


-- ---------- Check: who is a member? ----------
-- Run this on its own to see the list. It should show exactly the two of you.
-- select u.email, m.added_at from public.members m join auth.users u on u.id = m.user_id;
