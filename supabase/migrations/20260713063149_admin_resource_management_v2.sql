-- 관리자 자료 운영 대시보드와 단건 구매형 신앙자료 계약을 운영 DB에 맞춥니다.
-- 기존 자료와 Storage 객체는 삭제하지 않으며, 공개 여부는 status를 기준으로 관리합니다.

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.is_faith_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_faith_admin() from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_faith_admin() to authenticated, service_role;

-- 구독 상태를 참조하는 기존 정책을 먼저 제거한 뒤 단건 구매 정책으로 교체합니다.
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
    execute format(
      'drop policy if exists %I on %I.%I',
      legacy_policy.policyname,
      legacy_policy.schemaname,
      legacy_policy.tablename
    );
  end loop;
end;
$$;

alter table public.profiles
  drop column if exists subscription_status,
  drop column if exists current_period_end,
  drop column if exists cancel_at_period_end,
  drop column if exists cancellation_requested_at;

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
    execute format(
      'alter table public.faith_resources drop constraint if exists %I',
      legacy_constraint.conname
    );
  end loop;
end;
$$;

update public.faith_resources
set access_level = 'paid'
where access_level = 'subscriber';

alter table public.faith_resources
  alter column access_level set default 'paid',
  add column if not exists status text not null default 'draft',
  add column if not exists display_order integer not null default 0,
  add column if not exists published_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'faith_resources_access_level_check_v2'
      and conrelid = 'public.faith_resources'::regclass
  ) then
    alter table public.faith_resources
      add constraint faith_resources_access_level_check_v2
      check (access_level in ('free', 'paid'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'faith_resources_status_check_v2'
      and conrelid = 'public.faith_resources'::regclass
  ) then
    alter table public.faith_resources
      add constraint faith_resources_status_check_v2
      check (status in ('draft', 'published', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'faith_resources_display_order_check_v2'
      and conrelid = 'public.faith_resources'::regclass
  ) then
    alter table public.faith_resources
      add constraint faith_resources_display_order_check_v2
      check (display_order >= 0);
  end if;
end;
$$;

update public.faith_resources
set status = case when published then 'published' else 'draft' end,
    published_at = case when published then coalesce(published_at, updated_at, created_at) else null end;

-- 이전 화면에서 코드로만 제외하던 자료는 데이터 상태로 보관합니다.
update public.faith_resources
set status = 'archived',
    published = false,
    published_at = null
where id = '9ac7451f-0ea2-48df-afed-8bcf6187faad'::uuid;

with ranked as (
  select id,
         row_number() over (partition by type order by created_at desc, id) - 1 as position
  from public.faith_resources
  where status <> 'archived'
)
update public.faith_resources as resource
set display_order = ranked.position
from ranked
where resource.id = ranked.id;

create or replace function private.sync_faith_resource_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.published is distinct from old.published then
    new.status := case when new.published then 'published' else 'draft' end;
  else
    new.published := new.status = 'published';
  end if;

  if new.status = 'published' then
    new.published_at := coalesce(new.published_at, timezone('utc', now()));
  else
    new.published_at := null;
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists faith_resources_sync_state_v2 on public.faith_resources;
create trigger faith_resources_sync_state_v2
  before insert or update on public.faith_resources
  for each row execute procedure private.sync_faith_resource_state();

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

create table if not exists public.faith_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id varchar(120) not null references public.faith_products(id) on delete restrict,
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

create table if not exists public.resource_preview_files (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.faith_resources(id) on delete cascade,
  bucket_id text not null default 'faith-resource-previews' check (bucket_id = 'faith-resource-previews'),
  object_path text not null check (char_length(trim(object_path)) > 0),
  file_name varchar(255) not null check (char_length(trim(file_name)) between 1 and 255),
  mime_type varchar(160) not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null default 0 check (file_size between 0 and 5242880),
  alt_text varchar(300) not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (bucket_id, object_path),
  unique (resource_id, sort_order)
);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists faith_products_touch_updated_at_v2 on public.faith_products;
create trigger faith_products_touch_updated_at_v2
  before update on public.faith_products
  for each row execute procedure private.touch_updated_at();

drop trigger if exists faith_orders_touch_updated_at_v2 on public.faith_orders;
create trigger faith_orders_touch_updated_at_v2
  before update on public.faith_orders
  for each row execute procedure private.touch_updated_at();

insert into public.faith_products (
  id,
  resource_id,
  type,
  title,
  summary,
  preview_items,
  sale_status,
  price_amount,
  currency,
  purchasable,
  published
)
select resource.id::text,
       resource.id,
       resource.type,
       resource.title,
       resource.summary,
       coalesce(details.preview_items, '[]'::jsonb),
       'inquiry',
       null,
       'KRW',
       false,
       resource.status = 'published'
from public.faith_resources as resource
left join public.faith_resource_private_details as details
  on details.resource_id = resource.id
on conflict (id) do update
set resource_id = excluded.resource_id,
    type = excluded.type,
    title = excluded.title,
    summary = excluded.summary,
    preview_items = excluded.preview_items,
    published = excluded.published,
    updated_at = timezone('utc', now());

update public.faith_products as product
set published = false
from public.faith_resources as resource
where product.resource_id = resource.id
  and resource.status <> 'published';

create unique index if not exists faith_products_resource_id_unique_idx
  on public.faith_products (resource_id)
  where resource_id is not null;
create index if not exists faith_resources_status_type_order_idx
  on public.faith_resources (status, type, display_order, created_at desc);
create index if not exists faith_resources_created_by_idx
  on public.faith_resources (created_by, created_at desc);
create index if not exists resource_files_resource_sort_idx
  on public.resource_files (resource_id, sort_order);
create unique index if not exists resource_files_bucket_path_unique_idx
  on public.resource_files (bucket_id, object_path);
create index if not exists resource_preview_files_resource_sort_idx
  on public.resource_preview_files (resource_id, sort_order);
create index if not exists faith_products_published_sale_idx
  on public.faith_products (published, sale_status, type);
create index if not exists faith_orders_user_created_idx
  on public.faith_orders (user_id, created_at desc);
create index if not exists faith_orders_user_product_idx
  on public.faith_orders (user_id, product_id, created_at desc);
create index if not exists faith_orders_paid_resource_idx
  on public.faith_orders (user_id, resource_id, paid_at desc)
  where status = 'paid';
create unique index if not exists faith_orders_active_or_paid_user_product_unique_idx
  on public.faith_orders (user_id, product_id)
  where status in ('ready', 'paid');
create index if not exists faith_orders_ready_expires_idx
  on public.faith_orders (expires_at)
  where status = 'ready';
create index if not exists resource_downloads_user_idx
  on public.resource_downloads (user_id, downloaded_at desc);

insert into storage.buckets (id, name, public)
values ('faith-resources', 'faith-resources', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'faith-resource-previews',
  'faith-resource-previews',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.faith_resources enable row level security;
alter table public.faith_resource_private_details enable row level security;
alter table public.resource_files enable row level security;
alter table public.resource_preview_files enable row level security;
alter table public.faith_products enable row level security;
alter table public.faith_orders enable row level security;
alter table public.faith_payment_events enable row level security;
alter table public.resource_downloads enable row level security;

do $$
declare
  target_table text;
  policy_name text;
begin
  foreach target_table in array array[
    'faith_resources',
    'faith_resource_private_details',
    'resource_files',
    'resource_preview_files',
    'faith_products',
    'faith_orders',
    'faith_payment_events',
    'resource_downloads'
  ]
  loop
    for policy_name in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, target_table);
    end loop;
  end loop;
end;
$$;

create policy faith_resources_read_published_v2 on public.faith_resources
  for select to anon, authenticated
  using (status = 'published' and published);
create policy faith_resources_admin_manage_v2 on public.faith_resources
  for all to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));

create policy faith_products_read_public_v2 on public.faith_products
  for select to anon, authenticated
  using (published and sale_status in ('inquiry', 'available'));
create policy faith_products_read_owned_v2 on public.faith_products
  for select to authenticated
  using (
    exists (
      select 1
      from public.faith_orders
      where faith_orders.product_id = faith_products.id
        and faith_orders.user_id = (select auth.uid())
        and faith_orders.status = 'paid'
    )
  );
create policy faith_products_admin_manage_v2 on public.faith_products
  for all to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));

create policy faith_orders_read_own_or_admin_v2 on public.faith_orders
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_faith_admin()));

create policy faith_private_details_read_owned_v2 on public.faith_resource_private_details
  for select to authenticated
  using (
    (select private.is_faith_admin())
    or exists (
      select 1 from public.faith_orders
      where faith_orders.user_id = (select auth.uid())
        and faith_orders.resource_id = faith_resource_private_details.resource_id
        and faith_orders.status = 'paid'
    )
  );
create policy faith_private_details_admin_manage_v2 on public.faith_resource_private_details
  for all to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));

create policy resource_files_read_owned_v2 on public.resource_files
  for select to authenticated
  using (
    (select private.is_faith_admin())
    or exists (
      select 1 from public.faith_orders
      where faith_orders.user_id = (select auth.uid())
        and faith_orders.resource_id = resource_files.resource_id
        and faith_orders.status = 'paid'
    )
  );
create policy resource_files_admin_manage_v2 on public.resource_files
  for all to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));

create policy resource_previews_read_published_v2 on public.resource_preview_files
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.faith_resources
      where faith_resources.id = resource_preview_files.resource_id
        and faith_resources.status = 'published'
        and faith_resources.published
    )
  );
create policy resource_previews_admin_manage_v2 on public.resource_preview_files
  for all to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));

create policy resource_downloads_read_own_or_admin_v2 on public.resource_downloads
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_faith_admin()));

drop policy if exists faith_storage_admin_manage_v1 on storage.objects;
drop policy if exists faith_storage_admin_insert_v1 on storage.objects;
drop policy if exists faith_storage_admin_update_v1 on storage.objects;
drop policy if exists faith_storage_admin_delete_v1 on storage.objects;
drop policy if exists faith_storage_subscriber_read_v1 on storage.objects;
drop policy if exists faith_storage_paid_order_read_v1 on storage.objects;
drop policy if exists faith_storage_admin_manage_v2 on storage.objects;
drop policy if exists faith_preview_storage_admin_manage_v2 on storage.objects;

create policy faith_storage_admin_manage_v2 on storage.objects
  for all to authenticated
  using (
    bucket_id = 'faith-resources'
    and (select private.is_faith_admin())
  )
  with check (
    bucket_id = 'faith-resources'
    and (select private.is_faith_admin())
  );

create policy faith_storage_paid_order_read_v2 on storage.objects
  for select to authenticated
  using (
    bucket_id = 'faith-resources'
    and exists (
      select 1
      from public.resource_files
      where resource_files.object_path = objects.name
        and (
          (select private.is_faith_admin())
          or exists (
            select 1 from public.faith_orders
            where faith_orders.user_id = (select auth.uid())
              and faith_orders.resource_id = resource_files.resource_id
              and faith_orders.status = 'paid'
          )
        )
    )
  );

create policy faith_preview_storage_admin_manage_v2 on storage.objects
  for all to authenticated
  using (
    bucket_id = 'faith-resource-previews'
    and (select private.is_faith_admin())
  )
  with check (
    bucket_id = 'faith-resource-previews'
    and (select private.is_faith_admin())
  );

create or replace function public.publish_faith_resource(p_resource_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_type text;
  file_count integer;
  invalid_file_count integer;
begin
  if not (select private.is_faith_admin()) then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  select type into target_type
  from public.faith_resources
  where id = p_resource_id
  for update;

  if target_type is null then
    raise exception '자료를 찾을 수 없습니다.';
  end if;

  if not exists (
    select 1 from public.faith_resource_private_details
    where resource_id = p_resource_id
      and char_length(trim(description)) >= 2
  ) then
    raise exception '상세 설명을 입력해 주세요.';
  end if;

  select count(*),
         count(*) filter (
           where case
             when target_type = 'pdf' then not (mime_type = 'application/pdf' or file_name ~* '\\.pdf$')
             when target_type = 'audio' then not (mime_type like 'audio/%' or file_name ~* '\\.mp3$')
             when target_type = 'card' then not (mime_type like 'image/%' or file_name ~* '\\.(jpe?g|png|webp)$')
             else true
           end
         )
  into file_count, invalid_file_count
  from public.resource_files
  where resource_id = p_resource_id;

  if file_count = 0 or invalid_file_count > 0 or (target_type = 'pdf' and file_count <> 1) then
    raise exception '자료 유형에 맞는 원본 파일 구성을 확인해 주세요.';
  end if;

  if not exists (
    select 1 from public.faith_products
    where id = p_resource_id::text
      and resource_id = p_resource_id
      and sale_status in ('inquiry', 'available')
  ) then
    raise exception '판매 설정을 확인해 주세요.';
  end if;

  update public.faith_resources
  set status = 'published',
      updated_by = (select auth.uid())
  where id = p_resource_id;

  update public.faith_products
  set published = true
  where id = p_resource_id::text;

  return p_resource_id;
end;
$$;

create or replace function public.reorder_faith_resources(p_type text, p_ordered_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_count integer;
  updated_count integer;
begin
  if not (select private.is_faith_admin()) then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if p_type not in ('pdf', 'audio', 'card') then
    raise exception '자료 유형을 확인해 주세요.';
  end if;

  select count(*) into expected_count
  from public.faith_resources
  where type = p_type
    and status <> 'archived';

  if cardinality(p_ordered_ids) <> expected_count
     or cardinality(p_ordered_ids) <> (
       select count(distinct resource_id)
       from unnest(p_ordered_ids) as resource_id
     )
     or exists (
       select 1
       from unnest(p_ordered_ids) as resource_id
       left join public.faith_resources on faith_resources.id = resource_id
       where faith_resources.id is null
          or faith_resources.type <> p_type
          or faith_resources.status = 'archived'
     ) then
    raise exception '현재 게시판의 전체 자료 순서를 다시 불러와 주세요.';
  end if;

  with ordered as (
    select resource_id, ordinality - 1 as position
    from unnest(p_ordered_ids) with ordinality as item(resource_id, ordinality)
  )
  update public.faith_resources as resource
  set display_order = ordered.position,
      updated_by = (select auth.uid())
  from ordered
  where resource.id = ordered.resource_id;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.publish_faith_resource(uuid) from public, anon;
revoke all on function public.reorder_faith_resources(text, uuid[]) from public, anon;
grant execute on function public.publish_faith_resource(uuid) to authenticated;
grant execute on function public.reorder_faith_resources(text, uuid[]) to authenticated;

revoke all on table public.faith_resources from anon, authenticated;
grant select (
  id, type, title, summary, tags, access_level, published, status,
  display_order, published_at, created_at, updated_at
) on table public.faith_resources to anon, authenticated;
grant insert, update, delete on table public.faith_resources to authenticated;

revoke all on table public.faith_products from anon, authenticated;
grant select on table public.faith_products to anon, authenticated;
grant insert, update, delete on table public.faith_products to authenticated;

revoke all on table public.faith_resource_private_details, public.resource_files from anon, authenticated;
grant select, insert, update, delete
  on table public.faith_resource_private_details, public.resource_files
  to authenticated;

revoke all on table public.resource_preview_files from anon, authenticated;
grant select on table public.resource_preview_files to anon, authenticated;
grant insert, update, delete on table public.resource_preview_files to authenticated;

revoke all on table public.faith_orders, public.resource_downloads, public.faith_payment_events from anon, authenticated;
grant select (
  id, user_id, product_id, resource_id, provider, order_id, amount, currency,
  status, expires_at, paid_at, canceled_at, created_at, updated_at
) on table public.faith_orders to authenticated;
grant select on table public.resource_downloads to authenticated;

grant all on table public.faith_resources, public.faith_resource_private_details,
  public.resource_files, public.resource_preview_files, public.faith_products,
  public.faith_orders, public.faith_payment_events, public.resource_downloads
  to service_role;
