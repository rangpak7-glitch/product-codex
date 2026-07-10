-- 기도의샘물 신앙자료 기본 스키마입니다.
-- 이 파일은 주문형 결제 마이그레이션보다 먼저 적용되어야 합니다.
-- 공개 목록은 발행된 자료의 메타데이터만 노출하며, 상세 원고와 파일은 비공개입니다.

create schema if not exists private;
revoke all on schema private from public;

-- 바로 뒤의 회원 마이그레이션이 public.profiles를 만들기 전에도 이 함수를 만들 수 있어야 합니다.
-- 동적 SQL은 고정된 public.profiles 조회만 수행하며, 호출자의 auth.uid()와 admin 역할만 확인합니다.
create or replace function private.is_faith_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  has_admin_role boolean := false;
begin
  if current_user_id is null or pg_catalog.to_regclass('public.profiles') is null then
    return false;
  end if;

  execute $query$
    select exists (
      select 1
      from public.profiles
      where id = $1
        and role = 'admin'
    )
  $query$
  into has_admin_role
  using current_user_id;

  return coalesce(has_admin_role, false);
end;
$$;

revoke all on function private.is_faith_admin() from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_faith_admin() to authenticated, service_role;

create table if not exists public.faith_resources (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('pdf', 'audio', 'card')),
  title varchar(160) not null check (char_length(trim(title)) between 2 and 160),
  summary varchar(500) not null check (char_length(trim(summary)) between 2 and 500),
  tags text[] not null default '{}'::text[],
  access_level text not null default 'paid' check (access_level in ('free', 'paid')),
  published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 새 설치에서는 위 create table 정의가 사용됩니다. 이미 존재하는 자료 테이블에는
-- 주문형 마이그레이션이 참조하는 열만 보수적으로 보강합니다.
alter table public.faith_resources
  add column if not exists type text,
  add column if not exists title varchar(160),
  add column if not exists summary varchar(500),
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists access_level text not null default 'paid',
  add column if not exists published boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete restrict,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.faith_resource_private_details (
  resource_id uuid primary key references public.faith_resources(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 2 and 10000),
  preview_items jsonb not null default '[]'::jsonb check (jsonb_typeof(preview_items) = 'array'),
  gallery_items jsonb not null default '[]'::jsonb check (jsonb_typeof(gallery_items) = 'array'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.faith_resource_private_details
  add column if not exists description text,
  add column if not exists preview_items jsonb not null default '[]'::jsonb,
  add column if not exists gallery_items jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.resource_files (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.faith_resources(id) on delete cascade,
  bucket_id text not null default 'faith-resources' check (bucket_id = 'faith-resources'),
  object_path text not null check (char_length(trim(object_path)) > 0),
  file_name varchar(255) not null check (char_length(trim(file_name)) between 1 and 255),
  mime_type varchar(160) not null default 'application/octet-stream',
  file_size bigint not null default 0 check (file_size >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.resource_files
  add column if not exists bucket_id text not null default 'faith-resources',
  add column if not exists object_path text,
  add column if not exists file_name varchar(255),
  add column if not exists mime_type varchar(160) not null default 'application/octet-stream',
  add column if not exists file_size bigint not null default 0,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

create index if not exists faith_resources_published_created_idx
  on public.faith_resources (published, created_at desc);
create index if not exists faith_resources_created_by_idx
  on public.faith_resources (created_by, created_at desc);
create index if not exists resource_files_resource_sort_idx
  on public.resource_files (resource_id, sort_order);

alter table public.faith_resources enable row level security;
alter table public.faith_resource_private_details enable row level security;
alter table public.resource_files enable row level security;

-- 발행된 자료의 목록용 메타데이터만 익명 방문자에게 읽기 허용합니다.
-- created_by는 열 단위 권한에서 제외해 공개 목록에 노출되지 않습니다.
drop policy if exists faith_resources_read_published_v1 on public.faith_resources;
create policy faith_resources_read_published_v1 on public.faith_resources
  for select to anon, authenticated
  using (published);

drop policy if exists faith_resources_admin_manage_v1 on public.faith_resources;
create policy faith_resources_admin_manage_v1 on public.faith_resources
  for all to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));

-- 상세 설명과 파일 메타데이터는 기본 상태에서 관리자만 다룹니다.
-- 바로 뒤의 주문형 마이그레이션이 결제 완료 주문에 대한 읽기 정책을 추가합니다.
drop policy if exists faith_private_details_admin_manage_v1 on public.faith_resource_private_details;
create policy faith_private_details_admin_manage_v1 on public.faith_resource_private_details
  for all to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));

drop policy if exists resource_files_admin_manage_v1 on public.resource_files;
create policy resource_files_admin_manage_v1 on public.resource_files
  for all to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));

-- 자료 원본 버킷은 항상 private입니다. 공개 URL이나 public bucket을 사용하지 않습니다.
insert into storage.buckets (id, name, public)
values ('faith-resources', 'faith-resources', false)
on conflict (id) do update
set public = false;

drop policy if exists faith_storage_admin_manage_v1 on storage.objects;
create policy faith_storage_admin_manage_v1 on storage.objects
  for all to authenticated
  using (
    bucket_id = 'faith-resources'
    and (select private.is_faith_admin())
  )
  with check (
    bucket_id = 'faith-resources'
    and (select private.is_faith_admin())
  );

revoke all on table public.faith_resources from anon, authenticated;
grant select (id, type, title, summary, tags, access_level, published, created_at, updated_at)
  on table public.faith_resources to anon, authenticated;
grant insert, update, delete on table public.faith_resources to authenticated;

revoke all on table public.faith_resource_private_details, public.resource_files from anon, authenticated;
grant select, insert, update, delete
  on table public.faith_resource_private_details, public.resource_files to authenticated;

grant all on table public.faith_resources, public.faith_resource_private_details, public.resource_files to service_role;
