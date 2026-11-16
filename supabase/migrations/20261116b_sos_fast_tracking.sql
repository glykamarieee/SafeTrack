-- 2026-11-16: SOS fast tracking lasts for the whole emergency (run in the Supabase SQL Editor).
-- After an SOS the watch saves and sends its location about every 5 seconds. It now keeps doing
-- so until the SOS is acknowledged or cancelled (at most 30 minutes; every 15 s below 15 % battery),
-- instead of a fixed 10 minutes. The watch learns that the SOS has ended from "activeSos" in the
-- response to each location it sends (record_watch_location_v2) and to its heartbeat.

CREATE OR REPLACE FUNCTION public.record_watch_location_v2(p_watch_id text, p_device_token text, p_latitude double precision, p_longitude double precision, p_accuracy_meters double precision DEFAULT NULL::double precision, p_recorded_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_battery_percent integer DEFAULT NULL::integer, p_network_type text DEFAULT NULL::text, p_device_model text DEFAULT NULL::text, p_speed_mps double precision DEFAULT NULL::double precision, p_heading_degrees double precision DEFAULT NULL::double precision, p_travel_mode text DEFAULT NULL::text, p_mode_confidence double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
  v_id uuid;
begin
  -- The original does the device check, the insert, safe-zone processing and
  -- raises the same hints (invalid_location, device_unlinked, ...).
  -- Values go in as untyped literals, so they take whatever parameter types
  -- the original declares (those are defined in the live database only).
  execute format(
    'select to_jsonb(public.record_watch_location(p_watch_id => %L, p_device_token => %L, p_latitude => %L, '
    'p_longitude => %L, p_accuracy_meters => %L, p_recorded_at => %L, p_battery_percent => %L, '
    'p_network_type => %L, p_device_model => %L))',
    p_watch_id, p_device_token, p_latitude, p_longitude, p_accuracy_meters, p_recorded_at,
    p_battery_percent, p_network_type, p_device_model
  ) into v_result;

  v_id := nullif(v_result ->> 'locationLogId', '')::uuid;
  if v_id is not null then
    update public.location_logs
    set speed_mps = case when p_speed_mps >= 0 and p_speed_mps < 150 then p_speed_mps end,
        heading_degrees = case when p_heading_degrees >= 0 and p_heading_degrees < 360 then p_heading_degrees end,
        travel_mode = public.clean_travel_mode(p_travel_mode),
        mode_confidence = case when p_mode_confidence between 0 and 1 then p_mode_confidence end
    where id = v_id;
  end if;

  -- Whether the child still has an active SOS: the watch keeps its fast SOS tracking only until
  -- the guardian acknowledges it or the child cancels it (watch app, SOS fast tracking).
  v_result := coalesce(v_result, '{}'::jsonb) || jsonb_build_object('activeSos', exists (
    select 1 from public.sos_alerts s
    join public.smartwatch_devices d on d.child_id = s.child_id
    where d.watch_id = upper(btrim(coalesce(p_watch_id, ''))) and s.status = 'active'));

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_watch_heartbeat(p_watch_id text, p_device_token text, p_battery_percent integer DEFAULT NULL::integer, p_network_type text DEFAULT NULL::text, p_device_model text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_device public.smartwatch_devices%rowtype;
begin
  v_device := public.watch_device(p_watch_id, p_device_token);
  perform public.touch_watch(v_device.id, p_battery_percent, p_network_type, p_device_model);

  return jsonb_build_object(
    'ok', true,
    'safeZone', public.safe_zone_status(v_device.child_id),
    'activeSos', exists (select 1 from public.sos_alerts s where s.child_id = v_device.child_id and s.status = 'active')
  );
end;
$function$;
