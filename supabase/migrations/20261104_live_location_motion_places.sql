-- SafeTrack: live location, travel mode and place details (2026-11-04)
--
-- 1. location_logs gets speed, heading, travel mode and mode confidence.
-- 2. location_logs joins the supabase_realtime publication, so the guardian
--    map moves as new points arrive (RLS still limits rows to the guardian's
--    own children). Before this, the app listened for inserts that were never
--    published, so the map only changed after a reload.
-- 3. record_watch_location_v2 / record_child_phone_location_v2: the existing
--    functions plus the motion fields. They call the unchanged originals, so
--    their checks, safe-zone processing and error hints stay exactly the same,
--    and watches or phones still on the old functions keep working.
-- 4. location_places: a shared cache of OpenStreetMap (Nominatim) addresses,
--    one row per ~55 m cell (location_cell). The apps look an address up once
--    per cell and save it with save_location_place. OSM data may be stored
--    (ODbL; the apps show "© OpenStreetMap contributors").
-- 5. send_guardian_push adds the known place to SOS and safe-zone pushes
--    ("Near: Rizal Ave, Caloocan"). Same behaviour as 20261017 otherwise; a
--    missing place never blocks the push.
--
-- Needs 20261017. Safe to run twice.

begin;

do $$
begin
  if to_regclass('public.location_logs') is null then
    raise exception 'Preflight failed: location_logs is missing.';
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'record_watch_location') then
    raise exception 'Preflight failed: record_watch_location() is missing.';
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'record_child_phone_location') then
    raise exception 'Preflight failed: record_child_phone_location() is missing.';
  end if;

  if to_regprocedure('public.send_guardian_push(uuid, text, text, jsonb)') is null then
    raise exception 'Preflight failed: send_guardian_push() is missing (run 20261017 first).';
  end if;

  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Preflight failed: the supabase_realtime publication is missing.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Motion columns
-- ---------------------------------------------------------------------------
alter table public.location_logs
  add column if not exists speed_mps real,
  add column if not exists heading_degrees real,
  add column if not exists travel_mode text,
  add column if not exists mode_confidence real;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'location_logs_travel_mode_check') then
    alter table public.location_logs
      add constraint location_logs_travel_mode_check
      check (travel_mode is null or travel_mode in ('still', 'walking', 'running', 'biking', 'vehicle', 'boat', 'unknown'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'location_logs_mode_confidence_check') then
    alter table public.location_logs
      add constraint location_logs_mode_confidence_check
      check (mode_confidence is null or (mode_confidence >= 0 and mode_confidence <= 1));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Live location in the app
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime' and pt.schemaname = 'public' and pt.tablename = 'location_logs'
  ) then
    alter publication supabase_realtime add table public.location_logs;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Location functions with motion fields
-- ---------------------------------------------------------------------------
create or replace function public.clean_travel_mode(p_mode text)
returns text
language sql
immutable
as $function$
  select case when p_mode in ('still', 'walking', 'running', 'biking', 'vehicle', 'boat', 'unknown') then p_mode end;
$function$;

create or replace function public.record_watch_location_v2(
  p_watch_id text,
  p_device_token text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null,
  p_recorded_at timestamptz default null,
  p_battery_percent integer default null,
  p_network_type text default null,
  p_device_model text default null,
  p_speed_mps double precision default null,
  p_heading_degrees double precision default null,
  p_travel_mode text default null,
  p_mode_confidence double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  return v_result;
end;
$function$;

create or replace function public.record_child_phone_location_v2(
  p_child_id uuid,
  p_device_token text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null,
  p_speed_mps double precision default null,
  p_heading_degrees double precision default null,
  p_travel_mode text default null,
  p_mode_confidence double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
  v_id uuid;
begin
  execute format(
    'select to_jsonb(public.record_child_phone_location(p_child_id => %L, p_device_token => %L, '
    'p_latitude => %L, p_longitude => %L, p_accuracy_meters => %L))',
    p_child_id, p_device_token, p_latitude, p_longitude, p_accuracy_meters
  ) into v_result;

  v_id := nullif(v_result #>> '{location,id}', '')::uuid;
  if v_id is not null then
    update public.location_logs
    set speed_mps = case when p_speed_mps >= 0 and p_speed_mps < 150 then p_speed_mps end,
        heading_degrees = case when p_heading_degrees >= 0 and p_heading_degrees < 360 then p_heading_degrees end,
        travel_mode = public.clean_travel_mode(p_travel_mode),
        mode_confidence = case when p_mode_confidence between 0 and 1 then p_mode_confidence end
    where id = v_id;

    v_result := jsonb_set(v_result, '{location}', (v_result -> 'location') || jsonb_build_object(
      'speed_mps', p_speed_mps, 'travel_mode', public.clean_travel_mode(p_travel_mode)));
  end if;

  return v_result;
end;
$function$;

grant execute on function public.record_watch_location_v2(text, text, double precision, double precision, double precision, timestamptz, integer, text, text, double precision, double precision, text, double precision) to anon, authenticated;
grant execute on function public.record_child_phone_location_v2(uuid, text, double precision, double precision, double precision, double precision, double precision, text, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Place (address) cache
-- ---------------------------------------------------------------------------
-- The same cell as lib/places.ts: floor(coordinate * 2000), about 55 m.
create or replace function public.location_cell(p_latitude double precision, p_longitude double precision)
returns text
language sql
immutable
as $function$
  select floor(p_latitude * 2000)::bigint::text || ':' || floor(p_longitude * 2000)::bigint::text;
$function$;

create table if not exists public.location_places (
  cell text primary key,
  latitude double precision not null,
  longitude double precision not null,
  label text not null,
  details jsonb not null default '{}'::jsonb,
  provider text not null default 'osm',
  fetched_at timestamptz not null default now()
);

alter table public.location_places enable row level security;

-- Street addresses are not personal data on their own; any signed-in user may
-- read them. Writes only go through save_location_place.
drop policy if exists "location_places read" on public.location_places;
create policy "location_places read" on public.location_places
  for select to authenticated using (true);

create or replace function public.save_location_place(
  p_latitude double precision,
  p_longitude double precision,
  p_label text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in to save a place.';
  end if;

  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or coalesce(length(trim(p_label)), 0) = 0 or length(p_label) > 300
     or length(coalesce(p_details, '{}'::jsonb)::text) > 4000 then
    raise exception 'Invalid place.';
  end if;

  insert into public.location_places (cell, latitude, longitude, label, details)
  values (public.location_cell(p_latitude, p_longitude), p_latitude, p_longitude, trim(p_label), coalesce(p_details, '{}'::jsonb))
  on conflict (cell) do update
    set label = excluded.label, details = excluded.details, latitude = excluded.latitude,
        longitude = excluded.longitude, fetched_at = now();
end;
$function$;

grant execute on function public.save_location_place(double precision, double precision, text, jsonb) to authenticated;
grant execute on function public.location_cell(double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. The known place in SOS and safe-zone pushes
-- ---------------------------------------------------------------------------
create or replace function public.send_guardian_push(p_guardian_id uuid, p_title text, p_body text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_messages jsonb;
  v_type text := coalesce(p_data ->> 'type', '');
  v_prefs public.guardian_notification_preferences%rowtype;
  v_channel text;
  v_body text := p_body;
  v_place text;
begin
  -- SOS and re-alerts always go out. Other categories respect the guardian's
  -- preferences (no row means everything on).
  if v_type not in ('sos', 'sos_realert') then
    select * into v_prefs
    from public.guardian_notification_preferences np
    where np.guardian_id = p_guardian_id;

    if found then
      if (v_type in ('entry', 'exit') and not v_prefs.safe_zone)
         or (v_type = 'possible_anomaly' and not v_prefs.anomaly)
         or (v_type in ('watch_disconnected', 'prolonged_inactivity') and not v_prefs.device) then
        return;
      end if;
    end if;
  end if;

  -- Where the child is, when an address for that spot is already known.
  if v_type in ('sos', 'sos_realert', 'entry', 'exit') then
    begin
      select lp.label into v_place
      from public.location_places lp
      where lp.cell = (
        select public.location_cell(coalesce(s.latitude, l.latitude), coalesce(s.longitude, l.longitude))
        from (select 1) one
        left join public.sos_alerts s
          on s.id = nullif(coalesce(p_data ->> 'sos_alert_id', p_data ->> 'alert_id'), '')::uuid
        left join lateral (
          select ll.latitude, ll.longitude from public.location_logs ll
          where ll.child_id = coalesce(s.child_id, nullif(p_data ->> 'child_id', '')::uuid)
          order by ll.recorded_at desc limit 1
        ) l on true
      );
      if v_place is not null then
        v_body := coalesce(v_body, '') || E'\nNear: ' || v_place;
      end if;
    exception
      when others then
        v_place := null;
    end;
  end if;

  v_channel := case
    when v_type in ('sos', 'sos_realert') then 'safetrack-sos-v2'
    when v_type in ('entry', 'exit') then 'safetrack-zones'
    else 'safetrack-alerts'
  end;

  select jsonb_agg(
    jsonb_build_object(
      'to', t.push_token,
      'sound', 'default',
      'priority', 'high',
      'channelId', v_channel,
      'title', p_title,
      'body', v_body,
      'data', coalesce(p_data, '{}'::jsonb)
    )
  )
  into v_messages
  from public.guardian_push_tokens t
  where t.guardian_id = p_guardian_id
    and t.is_active
    and t.push_token ~ '^Expo(nent)?PushToken\[[^\]]+\]$';

  if v_messages is null then
    return;
  end if;

  -- Asynchronous: the request is sent after this transaction commits.
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
exception
  when others then
    -- A failed notification must never block saving the alert itself.
    raise warning 'send_guardian_push failed: %', sqlerrm;
end;
$function$;

commit;
