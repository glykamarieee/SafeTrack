-- SafeTrack FINAL full integration migration (2026-09-19)
-- Purpose: connect Guardian, Galaxy Watch8/Wear OS, Admin Mobile/Web,
-- rule-based safety processing, Isolation Forest advisory notices, and reports.
--
-- This migration keeps the existing SafeTrack table set and extends existing
-- runtime tables rather than creating a separate child/watch database.

begin;

-- ---------------------------------------------------------------------------
-- SMARTWATCH RUNTIME / PAIRING STATE
-- ---------------------------------------------------------------------------
alter table public.smartwatch_devices
  add column if not exists last_seen_at timestamptz null,
  add column if not exists device_token_hash text null,
  add column if not exists pairing_code_hash text null,
  add column if not exists pairing_code_expires_at timestamptz null,
  add column if not exists pairing_code_created_at timestamptz null,
  add column if not exists last_battery_percent integer null,
  add column if not exists last_network_type text null,
  add column if not exists device_model text null,
  add column if not exists last_location_at timestamptz null,
  add column if not exists last_ai_review_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'smartwatch_devices_battery_percent_check'
      and conrelid = 'public.smartwatch_devices'::regclass
  ) then
    alter table public.smartwatch_devices
      add constraint smartwatch_devices_battery_percent_check
      check (last_battery_percent is null or last_battery_percent between 0 and 100);
  end if;
end $$;

-- AI/disconnection/inactivity notices use the existing geofence_events history
-- table so Guardian activity history and Admin reports do not require a 17th
-- core data table. Those events are not necessarily tied to a geofence.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'geofence_events'
      and column_name = 'geofence_id'
      and is_nullable = 'NO'
  ) then
    alter table public.geofence_events
      alter column geofence_id drop not null;
  end if;
end $$;

create index if not exists idx_smartwatch_devices_watch_id
  on public.smartwatch_devices (watch_id);

create index if not exists idx_smartwatch_devices_child_active
  on public.smartwatch_devices (child_id, is_active);

create index if not exists idx_smartwatch_devices_last_seen
  on public.smartwatch_devices (last_seen_at desc);

create index if not exists idx_location_logs_child_recorded_at
  on public.location_logs (child_id, recorded_at desc);

create index if not exists idx_geofence_events_child_occurred_at
  on public.geofence_events (child_id, occurred_at desc);

create index if not exists idx_geofence_events_child_type_occurred
  on public.geofence_events (child_id, event_type, occurred_at desc);

create index if not exists idx_sos_alerts_child_status_triggered_at
  on public.sos_alerts (child_id, status, triggered_at desc);

create index if not exists idx_guardian_push_tokens_guardian_active
  on public.guardian_push_tokens (guardian_id, is_active);

-- ---------------------------------------------------------------------------
-- AI BASELINE SAMPLING RPC
-- ---------------------------------------------------------------------------
-- Samples at most one valid point per time bucket. This avoids the old problem
-- where a 500-row query at a 30-second watch interval covered only a few hours
-- and therefore could never establish the required two-week baseline.
create or replace function public.safetrack_ai_baseline(
  p_child_id uuid,
  p_before timestamptz,
  p_days integer default 30,
  p_bucket_minutes integer default 10,
  p_max_accuracy_meters numeric default 100
)
returns table (
  latitude numeric,
  longitude numeric,
  accuracy_meters numeric,
  recorded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with valid_points as (
    select
      ll.latitude,
      ll.longitude,
      ll.accuracy_meters,
      ll.recorded_at,
      row_number() over (
        partition by date_bin(
          make_interval(mins => greatest(p_bucket_minutes, 1)),
          ll.recorded_at,
          timestamptz '2000-01-01 00:00:00+00'
        )
        order by ll.recorded_at desc
      ) as rn
    from public.location_logs ll
    where ll.child_id = p_child_id
      and ll.recorded_at < p_before
      and ll.recorded_at >= p_before - make_interval(days => greatest(p_days, 14))
      and ll.latitude between -90 and 90
      and ll.longitude between -180 and 180
      and (
        ll.accuracy_meters is null
        or ll.accuracy_meters <= p_max_accuracy_meters
      )
  )
  select
    vp.latitude,
    vp.longitude,
    vp.accuracy_meters,
    vp.recorded_at
  from valid_points vp
  where vp.rn = 1
  order by vp.recorded_at asc;
$$;

revoke all on function public.safetrack_ai_baseline(uuid, timestamptz, integer, integer, numeric) from public;
grant execute on function public.safetrack_ai_baseline(uuid, timestamptz, integer, integer, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- PRIVATE REPORT STORAGE
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('activity-reports', 'activity-reports', false)
on conflict (id) do update set public = false;

commit;
