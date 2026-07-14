-- Public audio samples share the existing preview bucket, while paid originals
-- remain in the private faith-resources bucket.
alter table public.resource_preview_files
  drop constraint if exists resource_preview_files_mime_type_check;

alter table public.resource_preview_files
  add constraint resource_preview_files_mime_type_check
  check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp3'));

alter table public.resource_preview_files
  drop constraint if exists resource_preview_files_file_size_check;

alter table public.resource_preview_files
  add constraint resource_preview_files_file_size_check
  check (
    (mime_type in ('image/jpeg', 'image/png', 'image/webp') and file_size between 0 and 5242880)
    or
    (mime_type in ('audio/mpeg', 'audio/mp3') and file_size between 0 and 15728640)
  );

update storage.buckets
set public = true,
    file_size_limit = 15728640,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp3']::text[]
where id = 'faith-resource-previews';
