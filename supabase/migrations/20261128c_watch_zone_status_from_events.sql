-- The watch and the child phone show the same safe-zone status as the guardian.
--
-- safe_zone_status() (returned to the watch and child phone with every
-- heartbeat and location) compared the newest point with each circle as if it
-- were exact. Indoors a Wi-Fi/cell point is 100-250 m off, so the watch said
-- "Outside safe zones" while the guardian app, which follows the entry/exit
-- events, said "Safe at Home".
--
-- Now it reads the same thing the guardian and the alerts use: the latest
-- entry/exit event of each enabled zone (written by process_safe_zone_events,
-- which allows for the fix's accuracy). Same jsonb shape as before:
-- { status: inside | outside | no_safe_zone | unavailable, zoneName, message,
--   latestLocationAt }. Run once in the SQL Editor.

begin;

do $$
begin
  if to_regprocedure('public.safe_zone_status(uuid)') is null then
    raise exception 'safe_zone_status(uuid) not found; nothing changed';
  end if;
  if (select format_type(prorettype, null) from pg_proc where oid = 'public.safe_zone_status(uuid)'::regprocedure) <> 'jsonb' then
    raise exception 'safe_zone_status(uuid) does not return jsonb; nothing changed';
  end if;
end $$;

create or replace function public.safe_zone_status(p_child_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_latest_at timestamptz;
  v_zone_count integer;
  v_inside_names text[];
begin
  select ll.recorded_at
  into v_latest_at
  from public.location_logs ll
  where ll.child_id = p_child_id
  order by ll.recorded_at desc
  limit 1;

  select count(*)
  into v_zone_count
  from public.geofences g
  where g.child_id = p_child_id
    and g.is_enabled;

  if v_zone_count = 0 then
    return jsonb_build_object(
      'status', 'no_safe_zone',
      'zoneName', null,
      'message', 'No active safe zone is configured.',
      'latestLocationAt', v_latest_at
    );
  end if;

  if v_latest_at is null then
    return jsonb_build_object(
      'status', 'unavailable',
      'zoneName', null,
      'message', 'Waiting for the first location.',
      'latestLocationAt', null
    );
  end if;

  -- Each enabled zone's latest entry/exit decides; the same events the guardian sees.
  select array_agg(z.name order by z.name)
  into v_inside_names
  from public.geofences z
  where z.child_id = p_child_id
    and z.is_enabled
    and (
      select ge.event_type
      from public.geofence_events ge
      where ge.child_id = p_child_id
        and ge.geofence_id = z.id
        and ge.event_type in ('entry', 'exit')
      order by ge.occurred_at desc
      limit 1
    ) = 'entry';

  if coalesce(array_length(v_inside_names, 1), 0) > 0 then
    return jsonb_build_object(
      'status', 'inside',
      'zoneName', array_to_string(v_inside_names, ', '),
      'message', 'Inside ' || array_to_string(v_inside_names, ', '),
      'latestLocationAt', v_latest_at
    );
  end if;

  return jsonb_build_object(
    'status', 'outside',
    'zoneName', null,
    'message', 'Outside safe zones',
    'latestLocationAt', v_latest_at
  );
end;
$function$;

commit;
