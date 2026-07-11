create table if not exists public.channel_posts (
  id uuid primary key default gen_random_uuid(),
  title varchar(160) not null check (char_length(trim(title)) between 2 and 160),
  body text not null check (char_length(trim(body)) between 2 and 5000),
  image_url text,
  related_video_id varchar(32),
  related_content_id varchar(120),
  related_resource_id varchar(120),
  youtube_post_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (status <> 'published' or published_at is not null)
);

create index if not exists channel_posts_published_at_idx
  on public.channel_posts (published_at desc)
  where status = 'published';

create index if not exists channel_posts_created_by_idx
  on public.channel_posts (created_by, created_at desc);

drop trigger if exists channel_posts_touch_updated_at on public.channel_posts;
create trigger channel_posts_touch_updated_at
  before update on public.channel_posts
  for each row execute procedure public.touch_member_updated_at();

alter table public.channel_posts enable row level security;

drop policy if exists channel_posts_read_published_or_admin on public.channel_posts;
create policy channel_posts_read_published_or_admin on public.channel_posts
  for select to anon, authenticated
  using (
    status = 'published'
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

drop policy if exists channel_posts_insert_admin on public.channel_posts;
create policy channel_posts_insert_admin on public.channel_posts
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

drop policy if exists channel_posts_update_admin on public.channel_posts;
create policy channel_posts_update_admin on public.channel_posts
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  )
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

drop policy if exists channel_posts_delete_admin on public.channel_posts;
create policy channel_posts_delete_admin on public.channel_posts
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

grant select on table public.channel_posts to anon, authenticated;
grant insert, update, delete on table public.channel_posts to authenticated;
grant all on table public.channel_posts to service_role;
