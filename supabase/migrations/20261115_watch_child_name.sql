-- SafeTrack: the watch shows the child's current name (2026-11-15)
--
-- The watch saved the child's name only once, when it was paired, so renaming
-- the child in the app (for example "Bil" -> "Child") never reached the watch.
-- push_watch_live is called at least every 20 s, so its answer now also carries
-- the child's current name ("childName"); the watch saves it when it changed.
-- No re-pairing is needed. Same checks and broadcast as 20261108b_live_battery.
--
-- Needs 20261108b_live_battery.sql. Safe to run twice.

begin;

do $$
begin
  if to_regprocedure('public.broadcast_child_live(uuid, text, double precision, double precision, double precision, timestamptz, double precision, double precision, text, double precision, integer, text)') is null then
    raise exception 'Preflight failed: broadcast_child_live() with battery is missing (run 20261108b_live_battery.sql first).';
  end if;
end;
$$;

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
  v_name text;
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

  select nullif(btrim(p.full_name), '') into v_name from public.persons p where p.id = v_device.child_id;

  return public.broadcast_child_live(
    v_device.child_id, 'smartwatch', p_latitude, p_longitude, p_accuracy_meters, p_recorded_at,
    p_speed_mps, p_heading_degrees, p_travel_mode, p_mode_confidence, p_battery_percent, p_network_type
  ) || jsonb_strip_nulls(jsonb_build_object('childName', v_name));
end;
$function$;

commit;
