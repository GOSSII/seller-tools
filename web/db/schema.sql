-- ============================================================================
-- Amazon Seller Tools — database schema (Phase 2)
-- Paste this whole file into the Supabase SQL editor and Run.
-- It is IDEMPOTENT: safe to run again after edits; it will not drop data.
--
-- Model (see docs/SAAS_PLAN.md §3):
--   * Every table has Row Level Security ON.
--   * A logged-in user can SELECT only their own rows.
--   * All WRITES happen through the service_role key inside web/api/*
--     functions, which bypasses RLS — so there are (almost) no write
--     policies here on purpose. The one exception is nothing: users never
--     write these tables directly. Profile name/email is kept in sync from
--     auth.users by the trigger at the bottom.
-- ============================================================================

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (id === auth.users.id)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  name               text,
  phone              text,
  is_admin           boolean     not null default false,
  active_session_id  text,
  device_limit       int         not null default 3,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- entitlements: what plan a user has and until when
-- ---------------------------------------------------------------------------
create table if not exists public.entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  plan        text        not null check (plan in ('starter','pro')),
  source      text,                          -- 'razorpay' | 'admin' | ...
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz,
  payment_id  text,
  created_at  timestamptz not null default now()
);
create index if not exists entitlements_user_idx
  on public.entitlements (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- payments: one row per Razorpay order/payment
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  razorpay_order_id   text,
  razorpay_payment_id text unique,           -- idempotency key for the webhook
  amount_paise        int,
  plan                text,
  period              text,                  -- 'monthly' | 'yearly'
  status              text,                  -- 'pending' | 'paid' | 'failed'
  raw                 jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists payments_user_idx
  on public.payments (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- login_events: audit trail of logins (Phase 5)
-- ---------------------------------------------------------------------------
create table if not exists public.login_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  at               timestamptz not null default now(),
  ip               text,
  user_agent       text,
  device_hash      text,
  kicked_previous  boolean     not null default false
);
create index if not exists login_events_user_idx
  on public.login_events (user_id, at desc);

-- ---------------------------------------------------------------------------
-- devices: known devices per user (Phase 5)
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  device_hash  text        not null,
  label        text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  unique (user_id, device_hash)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.entitlements  enable row level security;
alter table public.payments      enable row level security;
alter table public.login_events  enable row level security;
alter table public.devices       enable row level security;

-- Read-your-own on every table. (drop-then-create keeps this idempotent.)
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own on public.entitlements
  for select using (auth.uid() = user_id);

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select using (auth.uid() = user_id);

drop policy if exists login_events_select_own on public.login_events;
create policy login_events_select_own on public.login_events
  for select using (auth.uid() = user_id);

drop policy if exists devices_select_own on public.devices;
create policy devices_select_own on public.devices
  for select using (auth.uid() = user_id);

-- Note: no INSERT/UPDATE/DELETE policies. Anon/authenticated clients cannot
-- write these tables. Our web/api/* functions use the service_role key, which
-- bypasses RLS entirely. This is what keeps is_admin, plans and payments
-- tamper-proof from the browser. Profile name is edited via Supabase Auth
-- (auth.updateUser -> user_metadata) and mirrored below.

-- ---------------------------------------------------------------------------
-- Keep profiles in sync with auth.users (create on signup, sync email/name)
-- ---------------------------------------------------------------------------
create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do update
    set email = excluded.email,
        name  = coalesce(nullif(excluded.name, ''), public.profiles.name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_change on auth.users;
create trigger on_auth_user_change
  after insert or update on auth.users
  for each row execute function public.handle_auth_user();

-- ---------------------------------------------------------------------------
-- One-time backfill for any users that already exist (harmless if none)
-- ---------------------------------------------------------------------------
insert into public.profiles (id, email, name)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'name', '')
from auth.users u
on conflict (id) do nothing;

-- ============================================================================
-- Phase 4b: auto-renewal via Razorpay Subscriptions
-- (idempotent additions — re-run this whole file after pulling this change)
-- ============================================================================

-- One row per Razorpay subscription a user has started.
create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users(id) on delete cascade,
  rzp_subscription_id  text unique,
  plan_key             text,                 -- 'starter_monthly' | ... (PRICES key)
  plan                 text,                 -- 'starter' | 'pro'
  period               text,                 -- 'monthly' | 'yearly'
  status               text        not null default 'created',
    -- created | active | cancel_requested | cancelled | halted | completed | paused
  current_end          timestamptz,          -- end of the currently-paid cycle (≈ next charge)
  created_at           timestamptz not null default now()
);
create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id, created_at desc);

alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select using (auth.uid() = user_id);

-- Cache of Razorpay Plan ids created by the server (keyed per plan_key AND
-- Razorpay key id, so test-mode and live-mode plan ids never mix).
-- Service-role only: RLS on with no policies.
create table if not exists public.rzp_plans (
  key          text primary key,
  rzp_plan_id  text not null,
  created_at   timestamptz not null default now()
);
alter table public.rzp_plans enable row level security;
