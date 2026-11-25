-- 2026-11-25 (unit testing findings)
-- 1. CASE-132: a watch that restarts or reconnects before hearing SafeTrack's answer sends the same
--    saved point again (same recorded time). record_watch_location now reuses the row already saved
--    for that child, time and position instead of saving it twice. Points without a recorded time
--    are saved as before.
-- 2. Safe-zone pushes now add "Near: <place>" like SOS pushes: the safety-event trigger also passes
--    'child_id', the key send_guardian_push reads to find the child's latest location.
-- Both functions are patched in place (exact text replacement of their live definitions), so
-- everything else in them stays as it is. Each patch fails loudly if the expected text is missing.

do $patch$
declare
  v_def text;
  v_new text;
begin
  -- 1. record_watch_location: reuse an identical saved point.
  select pg_get_functiondef('public.record_watch_location(text, text, double precision, double precision, double precision, timestamp with time zone, integer, text, text)'::regprocedure)
    into v_def;
  v_def := replace(v_def, E'\r\n', E'\n');   -- the live text uses CRLF line ends
  if position('Same point sent again' in v_def) = 0 then
    v_new := replace(v_def,
      '  v_location := public.insert_watch_location(
    v_device.id, v_device.child_id, p_latitude, p_longitude, p_accuracy_meters, p_recorded_at
  );',
      '  -- Same point sent again (watch restarted or reconnected before the answer): not saved twice.
  if p_recorded_at is not null then
    select l.* into v_location
    from public.location_logs l
    where l.child_id = v_device.child_id
      and l.recorded_at = p_recorded_at
      and l.latitude = p_latitude
      and l.longitude = p_longitude
    limit 1;
  end if;

  if v_location.id is null then
    v_location := public.insert_watch_location(
      v_device.id, v_device.child_id, p_latitude, p_longitude, p_accuracy_meters, p_recorded_at
    );
  end if;');
    if v_new = v_def then
      raise exception 'record_watch_location: expected insert call not found; nothing changed.';
    end if;
    execute v_new;
  end if;

  -- 2. notify_guardian_of_safety_event: pass child_id for the "Near:" line.
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'notify_guardian_of_safety_event';
  v_def := replace(v_def, E'\r\n', E'\n');
  if position('''child_id'', new.child_id' in v_def) = 0 then
    v_new := replace(v_def, '''childId'', new.child_id,', '''childId'', new.child_id,
        ''child_id'', new.child_id,');
    if v_new = v_def then
      raise exception 'notify_guardian_of_safety_event: expected childId key not found; nothing changed.';
    end if;
    execute v_new;
  end if;
end;
$patch$;
