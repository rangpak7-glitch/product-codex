-- PDF 자료는 1~3페이지 공개 미리보기가 준비된 경우에만 공개할 수 있습니다.

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

    if preview_count < 1 or preview_count > 3 or invalid_preview_count > 0 then
      raise exception '기도문 PDF를 공개하려면 1~3페이지 공개 미리보기를 준비해 주세요.';
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
  set status = 'published',
      updated_by = (select auth.uid())
  where id = p_resource_id;

  update public.faith_products
  set published = true
  where id = p_resource_id::text;

  return p_resource_id;
end;
$$;
