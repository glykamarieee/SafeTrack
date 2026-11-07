-- SafeTrack: near real-time live position while a guardian is watching (2026-11-08)
--
-- 1. live_viewers: one row per child, "a guardian has this child's map open
--    until <until>". Guardians extend it with request_child_live() about every
--    15 s while the Home or Location map is open; it lapses on its own.
-- 2. push_watch_live / push_child_phone_live: the watch or phone sends each
--    fix (about once a second while watched). When a guardian is watching, the
--    fix is broadcast on the private Realtime topic child-live:<child id>;
--    nothing is written to location_logs, so the database does not grow. The
--    answer ({ "live": true/false }) tells the device whether to keep sending
--    every second or return to its normal pace. History rows are still saved
--    by record_*_location_v2 at the usual pace.
-- 3. RLS on realtime.messages: only the child's own guardians can join
--    child-live:<child id>. Devices never join a channel; they broadcast through
--    the functions above, authenticated by their device token.
--
-- Realtime keeps broadcast messages in realtime.messages for a few days and
-- then drops them on its own.
--
-- Needs 20261104. Safe to run twice.

begin;

do $$
begin
  if to_regprocedure('public.is_guardian_of(uuid)') is null then
    raise exception 'Preflight failed: is_guardian_of(uuid) is missing.';
  end if;

  if to_regprocedure('public.clean_travel_mode(text)') is null then
    raise exception 'Preflight failed: clean_travel_mode() is missing (run 20261104 first).';
  end if;

  if to_regprocedure('realtime.send(jsonb, text, text, boolean)') is null then
    raise exception 'Preflight failed: realtime.send() is missing (Supabase Realtime broadcast from the database).';
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'get_child_phone_state') then
    raise exception 'Preflight failed: get_child_phone_state() is missing.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Who is watching
-- ---------------------------------------------------------------------------
create table if not exists public.live_viewers (
  child_id uuid primary key references public.persons(id) on delete cascade,
  until timestamptz not null,
  requested_by uuid,
  updated_at timestamptz not null default now()
);

-- No policies: read and written only by the functions below.
alter table public.live_viewers enable row level security;

create or replace function public.request_child_live(p_child_id uuid, p_seconds integer default 30)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_seconds integer := least(greatest(coalesce(p_seconds, 30), 0), 60);
  v_until timestamptz;
begin
  if auth.uid() is null or p_child_id is null or not public.is_guardian_of(p_child_id) then
    raise exception 'Live location is only available for your own child.' using errcode = '42501';
  end if;

  -- 0 seconds: this guardian closed the map. Another guardian still watching
  -- keeps the session they extended.
  insert into public.live_viewers as lv (child_id, until, requested_by, updated_at)
  values (p_child_id, now() + make_interval(secs => v_seconds), auth.uid(), now())
  on conflict (child_id) do update
    set until = case
          when v_seconds > 0 then greatest(lv.until, excluded.until)
          when lv.requested_by = auth.uid() then least(lv.until, now())
          else lv.until
        end,
        requested_by = case when v_seconds > 0 then auth.uid() else lv.requested_by end,
        updated_at = now()
  returning lv.until into v_until;

  return jsonb_build_object('ok', true, 'live', v_until > now(), 'until', v_until);
end;
$function$;

revoke all on function public.request_child_live(uuid, integer) from public, anon;
grant execute on function public.request_child_live(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Broadcast one fix (internal)
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_child_live(
  p_child_id uuid,
  p_source text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_recorded_at timestamptz,
  p_speed_mps double precision,
  p_heading_degrees double precision,
  p_travel_mode text,
  p_mode_confidence double precision
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_until timestamptz;
begin
  select lv.until into v_until from public.live_viewers lv where lv.child_id = p_child_id;

  if v_until is null or v_until <= now() then
    return jsonb_build_object('live', false);
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid location.' using errcode = '22023', hint = 'invalid_location';
  end if;

  perform realtime.send(
    jsonb_build_object(
      'childId', p_child_id,
      'source', p_source,
      'latitude', p_latitude,
      'longitude', p_longitude,
      'accuracyMeters', case when p_accuracy_meters >= 0 and p_accuracy_meters < 100000 then p_accuracy_meters end,
      'recordedAt', coalesce(least(p_recorded_at, now() + interval '1 minute'), now()),
      'sentAt', now(),
      'speedMps', case when p_speed_mps >= 0 and p_speed_mps < 150 then p_speed_mps end,
      'headingDegrees', case when p_heading_degrees >= 0 and p_heading_degrees < 360 then p_heading_degrees end,
      'travelMode', public.clean_travel_mode(p_travel_mode),
      'modeConfidence', case when p_mode_confidence between 0 and 1 then p_mode_confidence end
    ),
    'live',
    'child-live:' || p_child_id::text,
    true
  );

  return jsonb_build_object('live', true, 'until', v_until);
end;
$function$;

revoke all on function public.broadcast_child_live(uuid, text, double precision, double precision, double precision, timestamptz, double precision, double precision, text, double precision) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Device entry points
-- ---------------------------------------------------------------------------
-- Same device check as cancel_watch_sos (Watch ID + SHA-256 of the token).
-- Battery, network and model are accepted because the watch sends them with
-- every call; they are not stored here.
create or replace function public.push_watch_live(
  p_watch_id text,
  p_device_token text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null,
  p_recorded_at timestamptz default null,
  p_speed_mps double precision default null,
  p_heading_degrees double precision default null,
  p_travel_mode text default null,
  p_mode_confidence double precision default null,
  p_battery_percent integer default null,
  p_network_type text default null,
  p_device_model text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_device public.smartwatch_devices%rowtype;
begin
  select * into v_device
  from public.smartwatch_devices d
  where d.watch_id = upper(btrim(coalesce(p_watch_id, '')));

  if not found
     or not coalesce(v_device.is_active, false)
     or v_device.child_id is null
     or coalesce(v_device.device_token_hash, '') = ''
     or v_device.device_token_hash <> encode(sha256(convert_to(btrim(coalesce(p_device_token, '')), 'UTF8')), 'hex') then
    raise exception 'This watch is no longer connected to SafeTrack.'
      using errcode = '28000', hint = 'device_unlinked';
  end if;

  return public.broadcast_child_live(
    v_device.child_id, 'smartwatch', p_latitude, p_longitude, p_accuracy_meters, p_recorded_at,
    p_speed_mps, p_heading_degrees, p_travel_mode, p_mode_confidence
  );
end;
$function$;

revoke all on function public.push_watch_live(text, text, double precision, double precision, double precision, timestamptz, double precision, double precision, text, double precision, integer, text, text) from public;
grant execute on function public.push_watch_live(text, text, double precision, double precision, double precision, timestamptz, double precision, double precision, text, double precision, integer, text, text) to anon, authenticated;

-- The phone is checked by get_child_phone_state(), the phone's own function,
-- so the rules (and the "no longer linked" error, SQLSTATE 28000) stay the same.
create or replace function public.push_child_phone_live(
  p_child_id uuid,
  p_device_token text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null,
  p_recorded_at timestamptz default null,
  p_speed_mps double precision default null,
  p_heading_degrees double precision default null,
  p_travel_mode text default null,
  p_mode_confidence double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  execute format(
    'select public.get_child_phone_state(p_child_id => %L, p_device_token => %L)',
    p_child_id, p_device_token
  );

  return public.broadcast_child_live(
    p_child_id, 'mobile', p_latitude, p_longitude, p_accuracy_meters, p_recorded_at,
    p_speed_mps, p_heading_degrees, p_travel_mode, p_mode_confidence
  );
end;
$function$;

revoke all on function public.push_child_phone_live(uuid, text, double precision, double precision, double precision, timestamptz, double precision, double precision, text, double precision) from public;
grant execute on function public.push_child_phone_live(uuid, text, double precision, double precision, double precision, timestamptz, double precision, double precision, text, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Who may receive child-live:<child id>
-- ---------------------------------------------------------------------------
drop policy if exists "safetrack guardians receive child live" on realtime.messages;
create policy "safetrack guardians receive child live" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() ~ '^child-live:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_guardian_of(substr(realtime.topic(), 12)::uuid)
  );

commit;
