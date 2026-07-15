-- 기도문 PDF 판매 허브: 상품 마케팅 정보와 인쇄 라이선스 금액을 저장합니다.

alter table public.faith_products
  add column if not exists marketing_details jsonb not null default '{}'::jsonb,
  add column if not exists base_print_copies integer not null default 1,
  add column if not exists print_pack_size integer not null default 10,
  add column if not exists print_pack_price integer not null default 0;

alter table public.faith_products
  drop constraint if exists faith_products_marketing_details_object_check,
  add constraint faith_products_marketing_details_object_check
    check (jsonb_typeof(marketing_details) = 'object'),
  drop constraint if exists faith_products_base_print_copies_check,
  add constraint faith_products_base_print_copies_check check (base_print_copies >= 1),
  drop constraint if exists faith_products_print_pack_size_check,
  add constraint faith_products_print_pack_size_check check (print_pack_size >= 1),
  drop constraint if exists faith_products_print_pack_price_check,
  add constraint faith_products_print_pack_price_check check (print_pack_price >= 0);

update public.faith_products
set base_print_copies = 20,
    print_pack_size = 10,
    print_pack_price = 3000
where type = 'pdf';

alter table public.faith_orders
  add column if not exists requested_print_copies integer not null default 1,
  add column if not exists licensed_print_copies integer not null default 1,
  add column if not exists base_price_amount integer,
  add column if not exists license_surcharge_amount integer not null default 0;

update public.faith_orders
set base_price_amount = amount
where base_price_amount is null;

alter table public.faith_orders
  alter column base_price_amount set not null,
  drop constraint if exists faith_orders_requested_print_copies_check,
  add constraint faith_orders_requested_print_copies_check check (requested_print_copies >= 1),
  drop constraint if exists faith_orders_licensed_print_copies_check,
  add constraint faith_orders_licensed_print_copies_check check (licensed_print_copies >= requested_print_copies),
  drop constraint if exists faith_orders_base_price_amount_check,
  add constraint faith_orders_base_price_amount_check check (base_price_amount > 0),
  drop constraint if exists faith_orders_license_surcharge_amount_check,
  add constraint faith_orders_license_surcharge_amount_check check (license_surcharge_amount >= 0),
  drop constraint if exists faith_orders_amount_breakdown_check,
  add constraint faith_orders_amount_breakdown_check check (amount = base_price_amount + license_surcharge_amount);

-- 기존 공개 검증을 유지하되 PDF 공개 미리보기 상한만 4장으로 확장합니다.
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
  preview_count integer;
  invalid_preview_count integer;
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
    where resource_id = p_resource_id and char_length(trim(description)) >= 2
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

  if target_type = 'pdf' then
    select count(*),
           count(*) filter (
             where bucket_id <> 'faith-resource-previews'
                or char_length(trim(object_path)) = 0
                or not (mime_type like 'image/%' or file_name ~* '\\.(jpe?g|png|webp)$')
           )
    into preview_count, invalid_preview_count
    from public.resource_preview_files
    where resource_id = p_resource_id;

    if preview_count < 1 or preview_count > 4 or invalid_preview_count > 0 then
      raise exception '기도문 PDF를 공개하려면 1~4페이지 공개 미리보기를 준비해 주세요.';
    end if;
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
  set status = 'published', updated_by = (select auth.uid())
  where id = p_resource_id;

  update public.faith_products
  set published = true
  where id = p_resource_id::text;

  return p_resource_id;
end;
$$;

notify pgrst, 'reload schema';
