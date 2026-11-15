-- 2026-11-16: fixes found during integration testing (run in the Supabase SQL Editor).
--
-- 1. Tracking source follows the linked devices.
--    Linking a watch to a child registered as "mobile" (Connect > link a device) left the
--    source "mobile", so the guardian app said "Mobile" / "Location from the child's phone"
--    while every location came from the watch. Now it is set from the devices:
--    a linked watch and an active phone = both, only a watch = smartwatch, only a phone = mobile.
--    The administrator turning a watch off does not change it (the watch stays linked).
--
-- 2. Live updates count as contact from the watch.
--    push_watch_live (the 1-second live map) did not refresh last_seen_at, so while a guardian
--    watched the live map the scan could report "Smartwatch connection unavailable".

create or replace function public.sync_child_tracking_source(p_child_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_watch boolean;
  v_phone boolean;
  v_source text;
begin
  if p_child_id is null then return; end if;
  select exists (select 1 from public.smartwatch_devices w where w.child_id = p_child_id) into v_watch;
  select exists (select 1 from public.child_mobile_devices m
                 where m.child_id = p_child_id and coalesce(m.is_active, true)) into v_phone;
  if not v_watch and not v_phone then return; end if;
  v_source := case when v_watch and v_phone then 'both' when v_watch then 'smartwatch' else 'mobile' end;
  update public.persons p set tracking_source = v_source
  where p.id = p_child_id and p.tracking_source is distinct from v_source;
end;
$$;

revoke all on function public.sync_child_tracking_source(uuid) from public, anon, authenticated;

create or replace function public.sync_tracking_source_from_device()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_child_tracking_source(old.child_id);
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.child_id is distinct from old.child_id) then
    perform public.sync_child_tracking_source(new.child_id);
  end if;
  return null;
end;
$$;

create or replace function public.sync_tracking_source_from_phone()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_child_tracking_source(old.child_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_child_tracking_source(new.child_id);
  end if;
  return null;
end;
$$;

drop trigger if exists smartwatch_devices_sync_tracking_source on public.smartwatch_devices;
create trigger smartwatch_devices_sync_tracking_source
  after insert or update of child_id or delete on public.smartwatch_devices
  for each row execute function public.sync_tracking_source_from_device();

drop trigger if exists child_mobile_devices_sync_tracking_source on public.child_mobile_devices;
create trigger child_mobile_devices_sync_tracking_source
  after insert or update of child_id, is_active or delete on public.child_mobile_devices
  for each row execute function public.sync_tracking_source_from_phone();

-- Existing children: set the source from the devices linked now.
select public.sync_child_tracking_source(c.child_id)
from (select child_id from public.smartwatch_devices where child_id is not null
      union select child_id from public.child_mobile_devices where child_id is not null) c;

-- 2. push_watch_live: same as before, plus last_seen_at.
CREATE OR REPLACE FUNCTION public.push_watch_live(p_watch_id text, p_device_token text, p_latitude double precision, p_longitude double precision, p_accuracy_meters double precision DEFAULT NULL::double precision, p_recorded_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_speed_mps double precision DEFAULT NULL::double precision, p_heading_degrees double precision DEFAULT NULL::double precision, p_travel_mode text DEFAULT NULL::text, p_mode_confidence double precision DEFAULT NULL::double precision, p_battery_percent integer DEFAULT NULL::integer, p_network_type text DEFAULT NULL::text, p_device_model text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- A live update is contact from the watch too: last_seen_at is refreshed (at most once a
  -- minute), so a watch streaming to an open live map is never reported as disconnected.
  if (p_battery_percent between 0 and 100 and p_battery_percent is distinct from v_device.last_battery_percent)
     or (p_network_type is not null and p_network_type is distinct from v_device.last_network_type)
     or v_device.last_seen_at is null
     or v_device.last_seen_at < now() - interval '60 seconds' then
    update public.smartwatch_devices
    set last_battery_percent = case when p_battery_percent between 0 and 100 then p_battery_percent else last_battery_percent end,
        last_network_type = coalesce(left(p_network_type, 40), last_network_type),
        last_seen_at = now(),
        last_verified_at = now()
    where id = v_device.id;
  end if;

  select nullif(btrim(p.full_name), '') into v_name from public.persons p where p.id = v_device.child_id;

  return public.broadcast_child_live(
    v_device.child_id, 'smartwatch', p_latitude, p_longitude, p_accuracy_meters, p_recorded_at,
    p_speed_mps, p_heading_degrees, p_travel_mode, p_mode_confidence, p_battery_percent, p_network_type
  ) || jsonb_strip_nulls(jsonb_build_object('childName', v_name));
end;
$function$;
