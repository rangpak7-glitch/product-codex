-- 기도의샘물 회원, 소통게시판, 구독 결제의 추가형 스키마입니다.
-- 결제/빌링키/운영 기록은 Worker 서비스 역할만 기록하며 브라우저에 노출하지 않습니다.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  subscription_status text not null default 'free' check (subscription_status in ('free', 'active', 'canceling', 'past_due', 'refunded')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancellation_requested_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists role text not null default 'member',
  add column if not exists subscription_status text not null default 'free',
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.public_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname varchar(16) not null unique check (char_length(trim(nickname)) between 2 and 16),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_member_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_nickname text;
begin
  requested_nickname := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nickname', '')), '');
  if requested_nickname is null or char_length(requested_nickname) < 2 or char_length(requested_nickname) > 16 then
    raise exception '닉네임은 2자 이상 16자 이하로 입력해 주세요.';
  end if;

  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.public_profiles (id, nickname)
  values (new.id, requested_nickname)
  on conflict (id) do update
  set nickname = excluded.nickname,
      updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_for_membership on auth.users;
create trigger on_auth_user_created_for_membership
  after insert on auth.users
  for each row execute procedure public.handle_member_created();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

insert into public.public_profiles (id, nickname)
select id, '회원-' || replace(left(id::text, 8), '-', '')
from auth.users
on conflict (id) do nothing;

create or replace function public.touch_member_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists public_profiles_touch_updated_at on public.public_profiles;
create trigger public_profiles_touch_updated_at
  before update on public.public_profiles
  for each row execute procedure public.touch_member_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_member_updated_at();

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('prayer', 'gratitude')),
  title varchar(120) not null check (char_length(trim(title)) between 2 and 120),
  body text not null check (char_length(trim(body)) between 2 and 5000),
  status text not null default 'published' check (status in ('published', 'hidden', 'deleted')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 2 and 2000),
  status text not null default 'published' check (status in ('published', 'hidden', 'deleted')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'reply')),
  target_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 2 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.community_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  target_type text not null check (target_type in ('post', 'reply', 'report')),
  target_id uuid not null,
  action text not null check (action in ('hide', 'restore', 'resolve_report', 'dismiss_report')),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'toss',
  customer_key text not null unique,
  encrypted_billing_key text not null,
  key_version smallint not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'toss',
  order_id text not null unique,
  payment_key text unique,
  amount integer not null check (amount > 0),
  currency text not null default 'KRW',
  status text not null default 'ready' check (status in ('ready', 'paid', 'failed', 'canceled', 'refunded')),
  billing_cycle_start timestamptz,
  billing_cycle_end timestamptz,
  paid_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'toss',
  provider_event_id text not null unique,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.resource_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null,
  invoice_id uuid references public.subscription_invoices(id) on delete set null,
  downloaded_at timestamptz not null default timezone('utc', now()),
  ip_hash text,
  user_agent text
);

create index if not exists community_posts_published_created_idx on public.community_posts (status, created_at desc);
create index if not exists community_posts_author_idx on public.community_posts (author_id, created_at desc);
create index if not exists community_replies_post_idx on public.community_replies (post_id, created_at asc);
create index if not exists community_replies_author_idx on public.community_replies (author_id, created_at desc);
create index if not exists community_reports_status_idx on public.community_reports (status, created_at asc);
create index if not exists subscription_invoices_user_idx on public.subscription_invoices (user_id, created_at desc);
create index if not exists resource_downloads_user_idx on public.resource_downloads (user_id, downloaded_at desc);

drop trigger if exists community_posts_touch_updated_at on public.community_posts;
create trigger community_posts_touch_updated_at
  before update on public.community_posts
  for each row execute procedure public.touch_member_updated_at();

drop trigger if exists community_replies_touch_updated_at on public.community_replies;
create trigger community_replies_touch_updated_at
  before update on public.community_replies
  for each row execute procedure public.touch_member_updated_at();

drop trigger if exists billing_credentials_touch_updated_at on public.billing_credentials;
create trigger billing_credentials_touch_updated_at
  before update on public.billing_credentials
  for each row execute procedure public.touch_member_updated_at();

drop trigger if exists subscription_invoices_touch_updated_at on public.subscription_invoices;
create trigger subscription_invoices_touch_updated_at
  before update on public.subscription_invoices
  for each row execute procedure public.touch_member_updated_at();

alter table public.profiles enable row level security;
alter table public.public_profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_moderation_actions enable row level security;
alter table public.billing_credentials enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.payment_events enable row level security;
alter table public.resource_downloads enable row level security;

-- 이전 구현에서 남아 있을 수 있는 profiles 정책은 역할·구독 상태 노출을 막기 위해 교체합니다.
do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', policy_name);
  end loop;
end;
$$;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists public_profiles_read on public.public_profiles;
create policy public_profiles_read on public.public_profiles
  for select to anon, authenticated using (true);

drop policy if exists public_profiles_update_own on public.public_profiles;
create policy public_profiles_update_own on public.public_profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists community_posts_read_published_or_own on public.community_posts;
create policy community_posts_read_published_or_own on public.community_posts
  for select to anon, authenticated
  using (status = 'published' or author_id = (select auth.uid()));

drop policy if exists community_posts_insert_own on public.community_posts;
create policy community_posts_insert_own on public.community_posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'published');

drop policy if exists community_posts_update_own on public.community_posts;
create policy community_posts_update_own on public.community_posts
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and status = 'published');

drop policy if exists community_posts_delete_own on public.community_posts;
create policy community_posts_delete_own on public.community_posts
  for delete to authenticated using (author_id = (select auth.uid()));

drop policy if exists community_replies_read_published_or_own on public.community_replies;
create policy community_replies_read_published_or_own on public.community_replies
  for select to anon, authenticated
  using (status = 'published' or author_id = (select auth.uid()));

drop policy if exists community_replies_insert_own on public.community_replies;
create policy community_replies_insert_own on public.community_replies
  for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'published');

drop policy if exists community_replies_update_own on public.community_replies;
create policy community_replies_update_own on public.community_replies
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and status = 'published');

drop policy if exists community_replies_delete_own on public.community_replies;
create policy community_replies_delete_own on public.community_replies
  for delete to authenticated using (author_id = (select auth.uid()));

drop policy if exists community_reports_read_own on public.community_reports;
create policy community_reports_read_own on public.community_reports
  for select to authenticated using (reporter_id = (select auth.uid()));

drop policy if exists community_reports_insert_own on public.community_reports;
create policy community_reports_insert_own on public.community_reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

drop policy if exists subscription_invoices_read_own on public.subscription_invoices;
create policy subscription_invoices_read_own on public.subscription_invoices
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists resource_downloads_read_own on public.resource_downloads;
create policy resource_downloads_read_own on public.resource_downloads
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on table public.billing_credentials, public.payment_events, public.community_moderation_actions from anon, authenticated;
revoke execute on function public.handle_member_created() from public, anon, authenticated;
revoke execute on function public.touch_member_updated_at() from public, anon, authenticated;
grant select on table public.public_profiles to anon, authenticated;
grant select, insert, update, delete on table public.community_posts, public.community_replies, public.community_reports to authenticated;
grant select on table public.community_posts, public.community_replies to anon;
grant select on table public.profiles, public.subscription_invoices, public.resource_downloads to authenticated;
