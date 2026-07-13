-- RLS 정책을 역할과 작업별로 합쳐 Advisor 경고를 줄이고 관리자 조회를 유지합니다.

drop policy if exists faith_resources_read_published_v2 on public.faith_resources;
drop policy if exists faith_resources_admin_manage_v2 on public.faith_resources;
create policy faith_resources_read_public_v2 on public.faith_resources
  for select to anon
  using (status = 'published' and published);
create policy faith_resources_read_authenticated_v2 on public.faith_resources
  for select to authenticated
  using ((status = 'published' and published) or (select private.is_faith_admin()));
create policy faith_resources_admin_insert_v2 on public.faith_resources
  for insert to authenticated
  with check ((select private.is_faith_admin()));
create policy faith_resources_admin_update_v2 on public.faith_resources
  for update to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));
create policy faith_resources_admin_delete_v2 on public.faith_resources
  for delete to authenticated
  using ((select private.is_faith_admin()));

drop policy if exists faith_products_read_public_v2 on public.faith_products;
drop policy if exists faith_products_read_owned_v2 on public.faith_products;
drop policy if exists faith_products_admin_manage_v2 on public.faith_products;
create policy faith_products_read_public_v2 on public.faith_products
  for select to anon
  using (published and sale_status in ('inquiry', 'available'));
create policy faith_products_read_authenticated_v2 on public.faith_products
  for select to authenticated
  using (
    (published and sale_status in ('inquiry', 'available'))
    or (select private.is_faith_admin())
    or exists (
      select 1 from public.faith_orders
      where faith_orders.product_id = faith_products.id
        and faith_orders.user_id = (select auth.uid())
        and faith_orders.status = 'paid'
    )
  );
create policy faith_products_admin_insert_v2 on public.faith_products
  for insert to authenticated
  with check ((select private.is_faith_admin()));
create policy faith_products_admin_update_v2 on public.faith_products
  for update to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));
create policy faith_products_admin_delete_v2 on public.faith_products
  for delete to authenticated
  using ((select private.is_faith_admin()));

drop policy if exists faith_private_details_read_owned_v2 on public.faith_resource_private_details;
drop policy if exists faith_private_details_admin_manage_v2 on public.faith_resource_private_details;
create policy faith_private_details_read_authenticated_v2 on public.faith_resource_private_details
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
create policy faith_private_details_admin_insert_v2 on public.faith_resource_private_details
  for insert to authenticated
  with check ((select private.is_faith_admin()));
create policy faith_private_details_admin_update_v2 on public.faith_resource_private_details
  for update to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));
create policy faith_private_details_admin_delete_v2 on public.faith_resource_private_details
  for delete to authenticated
  using ((select private.is_faith_admin()));

drop policy if exists resource_files_read_owned_v2 on public.resource_files;
drop policy if exists resource_files_admin_manage_v2 on public.resource_files;
create policy resource_files_read_authenticated_v2 on public.resource_files
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
create policy resource_files_admin_insert_v2 on public.resource_files
  for insert to authenticated
  with check ((select private.is_faith_admin()));
create policy resource_files_admin_update_v2 on public.resource_files
  for update to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));
create policy resource_files_admin_delete_v2 on public.resource_files
  for delete to authenticated
  using ((select private.is_faith_admin()));

drop policy if exists resource_previews_read_published_v2 on public.resource_preview_files;
drop policy if exists resource_previews_admin_manage_v2 on public.resource_preview_files;
create policy resource_previews_read_public_v2 on public.resource_preview_files
  for select to anon
  using (
    exists (
      select 1 from public.faith_resources
      where faith_resources.id = resource_preview_files.resource_id
        and faith_resources.status = 'published'
        and faith_resources.published
    )
  );
create policy resource_previews_read_authenticated_v2 on public.resource_preview_files
  for select to authenticated
  using (
    (select private.is_faith_admin())
    or exists (
      select 1 from public.faith_resources
      where faith_resources.id = resource_preview_files.resource_id
        and faith_resources.status = 'published'
        and faith_resources.published
    )
  );
create policy resource_previews_admin_insert_v2 on public.resource_preview_files
  for insert to authenticated
  with check ((select private.is_faith_admin()));
create policy resource_previews_admin_update_v2 on public.resource_preview_files
  for update to authenticated
  using ((select private.is_faith_admin()))
  with check ((select private.is_faith_admin()));
create policy resource_previews_admin_delete_v2 on public.resource_preview_files
  for delete to authenticated
  using ((select private.is_faith_admin()));

create policy faith_payment_events_admin_read_v2 on public.faith_payment_events
  for select to authenticated
  using ((select private.is_faith_admin()));
grant select on table public.faith_payment_events to authenticated;

drop index if exists public.resource_files_bucket_path_unique_idx;
create index if not exists faith_orders_product_id_idx on public.faith_orders (product_id);
create index if not exists faith_orders_resource_id_idx on public.faith_orders (resource_id);
create index if not exists faith_resources_updated_by_idx on public.faith_resources (updated_by) where updated_by is not null;
create index if not exists resource_downloads_order_id_idx on public.resource_downloads (order_id) where order_id is not null;
create index if not exists resource_downloads_resource_id_idx on public.resource_downloads (resource_id);
