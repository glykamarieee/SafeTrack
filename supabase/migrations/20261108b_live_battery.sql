-- SafeTrack: the watch's battery and network with every live check (2026-11-08)
--
-- The watch saved its battery only with heartbeats (every 2 min) and location
-- records (every 3 min while still), so the guardian's phone could show a
-- value a few percent too high while the battery drained. push_watch_live is
-- called at least every 20 s (every 1-5 s while a guardian watches), so it now:
--   1. stores battery and network on smartwatch_devices when they changed;
--   2. adds them to the live broadcast, so an open map updates at once.
--
-- Needs 20261108_live_stream.sql. Safe to run twice.

begin;

do $$
begin
  if to_regprocedure('public.push_watch_live(text, text, double precision, double precision, double precision, timestamptz, double precision, double precision, text, double precision, integer, text, text)') is null then
    raise exception 'Preflight failed: push_watch_live() is missing (run 20261108_live_stream.sql first).';
  end if;
end;
$$;

-- Battery and network join the broadcast (optional, so the phone's call is unchanged).
drop function if exists public.broadcast_child_live(uuid, text, double precision, double precision, double precision, timestamptz, double precision, double precision, text, double precision);

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
  p_mode_confidence double precision,
  p_battery_percent integer default null,
  p_network_type text default null
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
      'modeConfidence', case when p_mode_confidence between 0 and 1 then p_mode_confidence end,
      'batteryPercent', case when p_battery_percent between 0 and 100 then p_battery_percent end,
      'networkType', left(p_network_type, 40)
    ),
    'live',
    'child-live:' || p_child_id::text,
    true
  );

  return jsonb_build_object('live', true, 'until', v_until);
end;
$function$;

revoke all on function public.broadcast_child_live(uuid, text, double precision, double precision, double precision, timestamptz, double precision, double precision, text, double precision, integer, text) from public, anon, authenticated;

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

  -- Written only when a value changed, so a check every few seconds costs no row update.
  if (p_battery_percent between 0 and 100 and p_battery_percent is distinct from v_device.last_battery_percent)
     or (p_network_type is not null and p_network_type is distinct from v_device.last_network_type) then
    update public.smartwatch_devices
    set last_battery_percent = case when p_battery_percent between 0 and 100 then p_battery_percent else last_battery_percent end,
        last_network_type = coalesce(left(p_network_type, 40), last_network_type)
    where id = v_device.id;
  end if;

  return public.broadcast_child_live(
    v_device.child_id, 'smartwatch', p_latitude, p_longitude, p_accuracy_meters, p_recorded_at,
    p_speed_mps, p_heading_degrees, p_travel_mode, p_mode_confidence, p_battery_percent, p_network_type
  );
end;
$function$;

commit;
