-- Safe zones: a coarse (Wi-Fi/cell) fix no longer counts as leaving a zone.
--
-- Indoors the watch has no GPS; its Wi-Fi/cell positions are 100-250 m off and
-- jump around. process_safe_zone_events compared each point with the radius as
-- if it were exact, so a point that landed just past the edge of Home recorded
-- "Exited Home" (and pushed the guardian) while the child sat at home.
--
-- Now, once a child is inside a zone, the exit needs the point to be outside
-- the radius by more than its accuracy (capped at 150 m): the child is only
-- "out" when even the most favourable reading of the fix is outside. Entering
-- is unchanged (the point inside the radius). Run once in the SQL Editor.

begin;

do $$
begin
  if to_regprocedure('public.process_safe_zone_events(uuid, uuid)') is null then
    raise exception 'process_safe_zone_events(uuid, uuid) not found; nothing changed';
  end if;
  if to_regprocedure('public.distance_meters(double precision, double precision, double precision, double precision)') is null then
    raise exception 'distance_meters(...) not found; nothing changed';
  end if;
end $$;

create or replace function public.process_safe_zone_events(p_child_id uuid, p_location_log_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_location public.location_logs%rowtype;
  v_zone record;
  v_inside boolean;
  v_previous text;
  v_distance double precision;
  v_slack double precision;
  v_inside_names text[] := '{}';
  v_zone_count integer := 0;
begin
  select *
  into v_location
  from public.location_logs ll
  where ll.id = p_location_log_id
    and ll.child_id = p_child_id;

  if not found then
    return 'Waiting for location';
  end if;

  -- How far off this fix may be (a GPS fix: a few metres; Wi-Fi/cell: 100 m+).
  v_slack := least(greatest(coalesce(v_location.accuracy_meters, 0), 0), 150);

  for v_zone in
    select g.id, g.name, g.latitude, g.longitude, g.radius_meters
    from public.geofences g
    where g.child_id = p_child_id
      and g.is_enabled
  loop
    v_zone_count := v_zone_count + 1;

    select ge.event_type
    into v_previous
    from public.geofence_events ge
    where ge.child_id = p_child_id
      and ge.geofence_id = v_zone.id
      and ge.event_type in ('entry', 'exit')
    order by ge.occurred_at desc
    limit 1;

    v_distance := public.distance_meters(
      v_location.latitude::double precision, v_location.longitude::double precision,
      v_zone.latitude::double precision, v_zone.longitude::double precision
    );

    -- Inside now: stays inside until the point is clearly out (beyond its accuracy).
    v_inside := case
      when v_previous = 'entry' then v_distance <= v_zone.radius_meters + v_slack
      else v_distance <= v_zone.radius_meters
    end;

    if v_inside then
      v_inside_names := v_inside_names || v_zone.name;
    end if;

    -- No history: only record an initial entry.
    if (v_previous is null and v_inside)
       or (v_previous = 'entry' and not v_inside)
       or (v_previous = 'exit' and v_inside) then
      insert into public.geofence_events (
        child_id, geofence_id, location_log_id, event_type,
        title, details, latitude, longitude, occurred_at
      )
      values (
        p_child_id,
        v_zone.id,
        v_location.id,
        case when v_inside then 'entry' else 'exit' end,
        case when v_inside then 'Entered ' else 'Exited ' end || v_zone.name,
        case when v_inside then 'The child entered the ' else 'The child exited the ' end
          || v_zone.name || ' safe zone.',
        v_location.latitude,
        v_location.longitude,
        now()
      );
    end if;
  end loop;

  if v_zone_count = 0 then
    return 'No safe zone configured';
  end if;

  if coalesce(array_length(v_inside_names, 1), 0) > 0 then
    return 'Inside ' || array_to_string(v_inside_names, ', ');
  end if;

  return 'Outside safe zones';
end;
$function$;

commit;
