create schema if not exists private;

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email varchar(254) not null,
  normalized_email text generated always as (lower(btrim(email))) stored,
  display_name varchar(100),
  source text not null default 'contact_form'
    check (source in ('contact_form', 'membership', 'purchase', 'admin')),
  lifecycle_stage text not null default 'lead'
    check (lifecycle_stage in ('lead', 'member', 'customer', 'inactive')),
  admin_notes text,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(email)) between 3 and 254 and position('@' in email) > 1),
  check (display_name is null or char_length(btrim(display_name)) between 1 and 100),
  check (admin_notes is null or char_length(admin_notes) <= 5000)
);

create unique index if not exists customer_contacts_normalized_email_unique_idx
  on public.customer_contacts (normalized_email);
create unique index if not exists customer_contacts_user_id_unique_idx
  on public.customer_contacts (user_id)
  where user_id is not null;
create index if not exists customer_contacts_lifecycle_last_seen_idx
  on public.customer_contacts (lifecycle_stage, last_seen_at desc);

create table if not exists public.customer_inquiries (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.customer_contacts(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  inquiry_type text not null
    check (inquiry_type in ('general', 'content', 'resource', 'account_purchase', 'privacy')),
  name varchar(100) not null,
  email varchar(254) not null,
  product_id varchar(120),
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'open', 'in_progress', 'resolved', 'spam')),
  admin_notes text,
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed', 'skipped')),
  notification_id varchar(200),
  notification_attempted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(btrim(name)) between 2 and 100),
  check (char_length(btrim(email)) between 3 and 254 and position('@' in email) > 1),
  check (product_id is null or char_length(btrim(product_id)) between 1 and 120),
  check (char_length(btrim(message)) between 10 and 5000),
  check (admin_notes is null or char_length(admin_notes) <= 5000)
);

create index if not exists customer_inquiries_status_created_idx
  on public.customer_inquiries (status, created_at desc);
create index if not exists customer_inquiries_contact_created_idx
  on public.customer_inquiries (contact_id, created_at desc);
create index if not exists customer_inquiries_user_created_idx
  on public.customer_inquiries (user_id, created_at desc)
  where user_id is not null;

create or replace function private.touch_customer_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists customer_contacts_touch_updated_at on public.customer_contacts;
create trigger customer_contacts_touch_updated_at
  before update on public.customer_contacts
  for each row execute procedure private.touch_customer_updated_at();

drop trigger if exists customer_inquiries_touch_updated_at on public.customer_inquiries;
create trigger customer_inquiries_touch_updated_at
  before update on public.customer_inquiries
  for each row execute procedure private.touch_customer_updated_at();

insert into public.customer_contacts (
  user_id,
  email,
  display_name,
  source,
  lifecycle_stage,
  first_seen_at,
  last_seen_at
)
select
  users.id,
  users.email,
  public_profiles.nickname,
  'membership',
  case
    when exists (
      select 1
      from public.faith_orders
      where faith_orders.user_id = users.id
        and faith_orders.status = 'paid'
    ) then 'customer'
    else 'member'
  end,
  coalesce(users.created_at, timezone('utc', now())),
  timezone('utc', now())
from auth.users as users
left join public.public_profiles on public_profiles.id = users.id
where users.email is not null
on conflict (normalized_email) do update
set
  user_id = coalesce(excluded.user_id, customer_contacts.user_id),
  display_name = coalesce(excluded.display_name, customer_contacts.display_name),
  lifecycle_stage = case
    when customer_contacts.lifecycle_stage = 'customer' or excluded.lifecycle_stage = 'customer' then 'customer'
    else 'member'
  end,
  last_seen_at = greatest(customer_contacts.last_seen_at, excluded.last_seen_at);

alter table public.customer_contacts enable row level security;
alter table public.customer_inquiries enable row level security;

revoke all on table public.customer_contacts, public.customer_inquiries from anon, authenticated;
grant all on table public.customer_contacts, public.customer_inquiries to service_role;
create or replace function public.handle_new_customer_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  insert into public.customer_contacts (
    user_id,
    email,
    display_name,
    source,
    lifecycle_stage,
    first_seen_at,
    last_seen_at
  )
  values (
    new.id,
    new.email,
    left(nullif(btrim(new.raw_user_meta_data ->> 'nickname'), ''), 100),
    'membership',
    'member',
    coalesce(new.created_at, timezone('utc', now())),
    timezone('utc', now())
  )
  on conflict (normalized_email) do update
  set
    user_id = excluded.user_id,
    display_name = coalesce(excluded.display_name, customer_contacts.display_name),
    lifecycle_stage = case
      when customer_contacts.lifecycle_stage = 'customer' then 'customer'
      else 'member'
    end,
    last_seen_at = excluded.last_seen_at;

  return new;
end;
$$;

revoke all on function public.handle_new_customer_contact() from public, anon, authenticated;
grant execute on function public.handle_new_customer_contact() to postgres, service_role;

drop trigger if exists on_auth_user_created_customer_contact on auth.users;
create trigger on_auth_user_created_customer_contact
  after insert on auth.users
  for each row execute procedure public.handle_new_customer_contact();
create or replace function private.sync_paid_order_customer_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer_email text;
  buyer_name text;
begin
  if new.status <> 'paid' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'paid' then
    return new;
  end if;

  update public.customer_contacts
  set
    lifecycle_stage = 'customer',
    source = case when source = 'admin' then source else 'purchase' end,
    last_seen_at = timezone('utc', now())
  where user_id = new.user_id;

  if found then
    return new;
  end if;

  select users.email, public_profiles.nickname
  into buyer_email, buyer_name
  from auth.users as users
  left join public.public_profiles on public_profiles.id = users.id
  where users.id = new.user_id;

  if buyer_email is null then
    return new;
  end if;

  insert into public.customer_contacts (
    user_id,
    email,
    display_name,
    source,
    lifecycle_stage,
    first_seen_at,
    last_seen_at
  )
  values (
    new.user_id,
    buyer_email,
    buyer_name,
    'purchase',
    'customer',
    coalesce(new.paid_at, new.created_at, timezone('utc', now())),
    timezone('utc', now())
  )
  on conflict (normalized_email) do update
  set
    user_id = excluded.user_id,
    display_name = coalesce(excluded.display_name, customer_contacts.display_name),
    source = case when customer_contacts.source = 'admin' then 'admin' else 'purchase' end,
    lifecycle_stage = 'customer',
    last_seen_at = excluded.last_seen_at;

  return new;
end;
$$;

revoke all on function private.sync_paid_order_customer_contact() from public, anon, authenticated;
grant execute on function private.sync_paid_order_customer_contact() to postgres, service_role;

drop trigger if exists faith_orders_sync_customer_contact on public.faith_orders;
create trigger faith_orders_sync_customer_contact
  after insert or update of status on public.faith_orders
  for each row
  when (new.status = 'paid')
  execute procedure private.sync_paid_order_customer_contact();
