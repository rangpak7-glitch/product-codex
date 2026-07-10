-- 기도의샘물 회원, 소통게시판, 개별 신앙자료 주문 스키마입니다.
-- 결제 승인·주문·다운로드 기록은 Worker 서비스 역할만 작성합니다.
-- 정기 구독, 빌링키, 자동 갱신은 이 스키마에 포함하지 않습니다.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists role text not null default 'member',
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- 기존 정기 구독 구현이 적용된 환경에서는 더 이상 쓰지 않는 상태값을 제거합니다.
do $$
declare
  legacy_policy record;
begin
  for legacy_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where coalesce(qual, '') ilike '%subscription_status%'
       or coalesce(with_check, '') ilike '%subscription_status%'
  loop
    execute format('drop policy if exists %I on %I.%I', legacy_policy.policyname, legacy_policy.schemaname, legacy_policy.tablename);
  end loop;
end;
$$;

alter table public.profiles
  drop column if exists subscription_status,
  drop column if exists current_period_end,
  drop column if exists cancel_at_period_end,
  drop column if exists cancellation_requested_at;

drop table if exists public.billing_credentials cascade;
drop table if exists public.subscription_invoices cascade;
drop table if exists public.payment_events cascade;

-- faith_resources는 보호 다운로드 자료만 담으므로 구독 전용 access level을 단건 구매 용어로 전환합니다.
do $$
declare
  legacy_constraint record;
begin
  for legacy_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.faith_resources'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%access_level%'
  loop
    execute format('alter table public.faith_resources drop constraint if exists %I', legacy_constraint.conname);
  end loop;
end;
$$;

update public.faith_resources
set access_level = 'paid'
where access_level = 'subscriber';

alter table public.faith_resources
  alter column access_level set default 'paid';

alter table public.faith_resources
  add constraint faith_resources_access_level_check check (access_level in ('free', 'paid'));

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

-- 상품은 가격을 확정하기 전에는 inquiry 상태로만 발행합니다.
-- 구매 가능한 상품만 positive price를 가질 수 있어 가격을 Worker에 하드코딩할 수 없습니다.
create table if not exists public.faith_products (
  id varchar(120) primary key check (id ~ '^[A-Za-z0-9_-]{2,120}$'),
  resource_id uuid references public.faith_resources(id) on delete restrict,
  type text not null check (type in ('pdf', 'audio', 'card', 'journey')),
  title varchar(200) not null check (char_length(trim(title)) between 2 and 200),
  summary text,
  preview_items jsonb not null default '[]'::jsonb check (jsonb_typeof(preview_items) = 'array'),
  sale_status text not null default 'inquiry' check (sale_status in ('inquiry', 'available', 'unavailable')),
  price_amount integer check (price_amount is null or price_amount > 0),
  currency varchar(3) not null default 'KRW' check (currency = 'KRW'),
  purchasable boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (sale_status = 'available' and purchasable and price_amount is not null)
    or (sale_status in ('inquiry', 'unavailable') and not purchasable and price_amount is null)
  )
);

create unique index if not exists faith_products_resource_id_unique_idx
  on public.faith_products (resource_id)
  where resource_id is not null;

create table if not exists public.faith_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id varchar(120) not null references public.faith_products(id) on delete restrict,
  -- 상품을 결제한 당시의 자료 연결값을 보관합니다. 여정 상품은 null일 수 있습니다.
  resource_id uuid references public.faith_resources(id) on delete restrict,
  provider text not null default 'toss',
  order_id varchar(64) not null unique check (order_id ~ '^[A-Za-z0-9_-]{6,64}$'),
  payment_key varchar(200) unique,
  amount integer not null check (amount > 0),
  currency varchar(3) not null default 'KRW' check (currency = 'KRW'),
  status text not null default 'ready' check (status in ('ready', 'paid', 'failed', 'canceled', 'refunded')),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '30 minutes'),
  paid_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 준비 상태 주문은 짧은 시간만 유효합니다. 이미 생성된 테스트 주문에도 만료 시각을 보완합니다.
alter table public.faith_orders
  add column if not exists expires_at timestamptz;

update public.faith_orders
set expires_at = created_at + interval '30 minutes'
where expires_at is null;

alter table public.faith_orders
  alter column expires_at set default (timezone('utc', now()) + interval '30 minutes'),
  alter column expires_at set not null;

-- 원본 웹훅 payload는 카드·구매자 정보가 섞일 수 있어 저장하지 않습니다.
-- 검증이 끝난 결제 식별자와 처리 상태만 서버 전용으로 기록합니다.
create table if not exists public.faith_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'toss',
  provider_event_id varchar(240) not null unique,
  event_type varchar(120),
  external_order_id varchar(64),
  payment_key varchar(200),
  payment_status varchar(40),
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.resource_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.faith_resources(id) on delete restrict,
  order_id uuid references public.faith_orders(id) on delete set null,
  downloaded_at timestamptz not null default timezone('utc', now())
);

-- 과거 구독 인보이스에 연결됐던 다운로드 기록도 주문 단위로 안전하게 바꿉니다.
alter table public.resource_downloads
  drop column if exists invoice_id,
  drop column if exists ip_hash,
  drop column if exists user_agent,
  add column if not exists order_id uuid references public.faith_orders(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resource_downloads_resource_id_fkey'
      and conrelid = 'public.resource_downloads'::regclass
  ) then
    alter table public.resource_downloads
      add constraint resource_downloads_resource_id_fkey
      foreign key (resource_id) references public.faith_resources(id) on delete restrict;
  end if;
end;
$$;

create index if not exists community_posts_published_created_idx on public.community_posts (status, created_at desc);
create index if not exists community_posts_author_idx on public.community_posts (author_id, created_at desc);
create index if not exists community_replies_post_idx on public.community_replies (post_id, created_at asc);
create index if not exists community_replies_author_idx on public.community_replies (author_id, created_at desc);
create index if not exists community_reports_status_idx on public.community_reports (status, created_at asc);
create index if not exists faith_products_published_sale_idx on public.faith_products (published, sale_status, type);
create index if not exists faith_orders_user_created_idx on public.faith_orders (user_id, created_at desc);
create index if not exists faith_orders_user_product_idx on public.faith_orders (user_id, product_id, created_at desc);
create index if not exists faith_orders_paid_resource_idx on public.faith_orders (user_id, resource_id, paid_at desc) where status = 'paid';
-- 동일 회원이 한 상품을 동시에 여러 번 결제하지 못하게 DB에서 원자적으로 제한합니다.
create unique index if not exists faith_orders_active_or_paid_user_product_unique_idx
  on public.faith_orders (user_id, product_id)
  where status in ('ready', 'paid');
create index if not exists faith_orders_ready_expires_idx on public.faith_orders (expires_at)
  where status = 'ready';
create index if not exists resource_downloads_user_idx on public.resource_downloads (user_id, downloaded_at desc);
create index if not exists resource_files_resource_object_path_idx on public.resource_files (resource_id, object_path);

drop trigger if exists community_posts_touch_updated_at on public.community_posts;
create trigger community_posts_touch_updated_at
  before update on public.community_posts
  for each row execute procedure public.touch_member_updated_at();

drop trigger if exists community_replies_touch_updated_at on public.community_replies;
create trigger community_replies_touch_updated_at
  before update on public.community_replies
  for each row execute procedure public.touch_member_updated_at();

drop trigger if exists faith_products_touch_updated_at on public.faith_products;
create trigger faith_products_touch_updated_at
  before update on public.faith_products
  for each row execute procedure public.touch_member_updated_at();

drop trigger if exists faith_orders_touch_updated_at on public.faith_orders;
create trigger faith_orders_touch_updated_at
  before update on public.faith_orders
  for each row execute procedure public.touch_member_updated_at();

alter table public.profiles enable row level security;
alter table public.public_profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_moderation_actions enable row level security;
alter table public.faith_products enable row level security;
alter table public.faith_orders enable row level security;
alter table public.faith_payment_events enable row level security;
alter table public.resource_downloads enable row level security;

-- 이전 구현에서 남아 있을 수 있는 profiles 정책은 역할 정보만 본인에게 보이도록 교체합니다.
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

drop policy if exists faith_products_read_published_or_purchased on public.faith_products;
create policy faith_products_read_published_or_purchased on public.faith_products
  for select to anon, authenticated
  using (
    published
    or (
      (select auth.uid()) is not null
      and exists (
        select 1
        from public.faith_orders
        where faith_orders.product_id = faith_products.id
          and faith_orders.user_id = (select auth.uid())
          and faith_orders.status = 'paid'
      )
    )
  );

drop policy if exists faith_products_admin_manage on public.faith_products;
create policy faith_products_admin_manage on public.faith_products
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

drop policy if exists faith_orders_read_own on public.faith_orders;
create policy faith_orders_read_own on public.faith_orders
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists faith_private_details_read_v2 on public.faith_resource_private_details;
drop policy if exists faith_private_details_read_paid_order_v1 on public.faith_resource_private_details;
create policy faith_private_details_read_paid_order_v1 on public.faith_resource_private_details
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
    or exists (
      select 1 from public.faith_orders
      where faith_orders.user_id = (select auth.uid())
        and faith_orders.resource_id = faith_resource_private_details.resource_id
        and faith_orders.status = 'paid'
    )
  );

drop policy if exists resource_files_read_v2 on public.resource_files;
drop policy if exists resource_files_read_paid_order_v1 on public.resource_files;
create policy resource_files_read_paid_order_v1 on public.resource_files
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
    or exists (
      select 1 from public.faith_orders
      where faith_orders.user_id = (select auth.uid())
        and faith_orders.resource_id = resource_files.resource_id
        and faith_orders.status = 'paid'
    )
  );

drop policy if exists faith_storage_subscriber_read_v1 on storage.objects;
drop policy if exists faith_storage_paid_order_read_v1 on storage.objects;
create policy faith_storage_paid_order_read_v1 on storage.objects
  for select to authenticated
  using (
    bucket_id = 'faith-resources'
    and exists (
      select 1
      from public.resource_files
      where resource_files.object_path = objects.name
        and (
          exists (
            select 1 from public.profiles
            where profiles.id = (select auth.uid()) and profiles.role = 'admin'
          )
          or exists (
            select 1 from public.faith_orders
            where faith_orders.user_id = (select auth.uid())
              and faith_orders.resource_id = resource_files.resource_id
              and faith_orders.status = 'paid'
          )
        )
    )
  );

drop policy if exists resource_downloads_read_own on public.resource_downloads;
create policy resource_downloads_read_own on public.resource_downloads
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on table public.community_moderation_actions, public.faith_payment_events from anon, authenticated;
revoke all on table public.faith_orders, public.resource_downloads from anon, authenticated;
revoke all on table public.faith_products from anon, authenticated;
revoke execute on function public.handle_member_created() from public, anon, authenticated;
revoke execute on function public.touch_member_updated_at() from public, anon, authenticated;

grant select on table public.public_profiles, public.faith_products to anon, authenticated;
grant insert, update, delete on table public.faith_products to authenticated;
grant select, insert, update, delete on table public.community_posts, public.community_replies, public.community_reports to authenticated;
grant select on table public.community_posts, public.community_replies to anon;
grant select on table public.profiles, public.resource_downloads to authenticated;
grant select (id, user_id, product_id, resource_id, provider, order_id, amount, currency, status, expires_at, paid_at, canceled_at, created_at, updated_at)
  on table public.faith_orders to authenticated;
grant all on table public.profiles, public.public_profiles, public.community_posts, public.community_replies, public.community_reports, public.community_moderation_actions, public.faith_products, public.faith_orders, public.faith_payment_events, public.resource_downloads to service_role;
