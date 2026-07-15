alter table public.faith_orders
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_reason text;

create table if not exists public.faith_refund_actions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.faith_orders(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 2 and 300),
  amount integer not null check (amount > 0),
  download_count integer not null default 0 check (download_count >= 0),
  status text not null check (status in ('requested', 'completed', 'failed')),
  provider_transaction_key varchar(200),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists faith_refund_actions_order_id_idx
  on public.faith_refund_actions(order_id);

create index if not exists faith_refund_actions_created_at_idx
  on public.faith_refund_actions(created_at desc);

alter table public.faith_refund_actions enable row level security;

revoke all on table public.faith_refund_actions from anon, authenticated;
grant all on table public.faith_refund_actions to service_role;
