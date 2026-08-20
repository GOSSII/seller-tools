-- ============================================================================
-- Seller Tools India — database schema (Phase 2)
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
-- One entitlement per Razorpay payment. The webhook can be delivered twice for
-- one charge (payment.captured + subscription.charged, or a Razorpay retry);
-- this makes the second insert a no-op instead of a second paid period.
-- A full UNIQUE constraint, not a partial index: PostgREST's
-- on_conflict=payment_id (used by the webhook's grant insert) can only
-- target a real constraint — with the old partial index Postgres answered
-- 42P10 and the first live webhook grant failed forever. Admin grants keep
-- payment_id NULL, and a UNIQUE btree allows any number of NULLs, so they
-- stay unconstrained exactly as before.
alter table public.entitlements drop constraint if exists entitlements_payment_id_key;
alter table public.entitlements
  add constraint entitlements_payment_id_key unique (payment_id);

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

-- ============================================================================
-- Presence (owner request 2026-07-30): who is online right now + session length
-- (idempotent — re-run this whole file after pulling this change)
-- ============================================================================
-- One row per browser tab-session. sid is a random per-tab id (sessionStorage);
-- no IP or user-agent stored. user_id set only when the visitor is logged in.
create table if not exists public.presence (
  sid           text primary key,
  user_id       uuid references auth.users(id) on delete set null,
  route         text,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists presence_last_seen_idx on public.presence (last_seen_at desc);
alter table public.presence enable row level security;  -- service-role only

-- ============================================================================
-- Client errors (Phase 8): production JS errors reported by the page itself,
-- shown in the hidden admin panel. No user identity, no IP — just what broke
-- and where. (idempotent — re-run this whole file after pulling this change)
-- ============================================================================
create table if not exists public.client_errors (
  id       uuid primary key default gen_random_uuid(),
  at       timestamptz not null default now(),
  route    text,
  message  text,
  source   text,
  line     integer,
  col      integer
);
create index if not exists client_errors_at_idx on public.client_errors (at desc);
alter table public.client_errors enable row level security;  -- service-role only

-- ---------------------------------------------------------------------------
-- Hardening (added after the 2026-08 monetization audit). Safe to re-run.
-- ---------------------------------------------------------------------------

-- One payments row per Razorpay order: the webhook flips a row to 'paid' by
-- order id, and a duplicate pending row would make that PATCH ambiguous.
create unique index if not exists payments_order_uniq
  on public.payments (razorpay_order_id) where razorpay_order_id is not null;

-- The active session token must not be readable by the browser: a signed-out
-- tab could read the winning session's id and replay it as X-Session-Id,
-- defeating the one-login rule. RLS scopes ROWS; this scopes COLUMNS.
-- (The client only ever selects device_limit and email,is_admin.)
revoke select on public.profiles from anon, authenticated;
grant select (id, email, name, is_admin, device_limit, created_at)
  on public.profiles to authenticated;

-- Status vocabularies, documented above but never enforced. NOT VALID so
-- existing rows can't block the migration.
do $$ begin
  alter table public.subscriptions add constraint subscriptions_status_chk
    check (status in ('created','authenticated','active','pending','cancel_requested',
                      'cancelled','halted','completed','paused','expired')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.payments add constraint payments_status_chk
    check (status in ('pending','paid','failed','refunded')) not valid;
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- counters: public social-proof tallies ("N labels cropped so far").
-- RLS on with no policies: PostgREST anon/authenticated can neither read nor
-- write; our /api/counter endpoint uses the service role for both. The
-- increment is an atomic SECURITY DEFINER function so concurrent runs never
-- lose counts, and it is revoked from every client-facing role.
create table if not exists public.counters (
  key   text primary key,
  value bigint not null default 0
);
alter table public.counters enable row level security;
insert into public.counters (key, value) values ('label_cropper', 0) on conflict do nothing;
create or replace function public.counter_add(k text, n bigint) returns bigint
language sql security definer set search_path = public as
$$ update counters set value = value + n where key = k returning value; $$;
revoke all on function public.counter_add(text, bigint) from public, anon, authenticated;
