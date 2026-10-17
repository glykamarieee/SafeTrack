-- SafeTrack: alert sounds and live safety events (2026-10-17)
--
-- 1. send_guardian_push() sends each alert on its own Android channel, so a
--    push received while SafeTrack is closed plays the same sound as in the
--    app (the app creates these channels):
--      sos, sos_realert                -> safetrack-sos    (siren)
--      entry, exit                     -> safetrack-zones  (chime)
--      everything else                 -> safetrack-alerts (phone's default)
--    Same signature, preference check and behaviour as 20261015 otherwise.
-- 2. geofence_events joins the supabase_realtime publication, so the app gets
--    safe-zone, anomaly and device events live and can show them as phone
--    notifications while it runs (RLS still limits rows to the guardian's own
--    children).
--
-- Needs 20261015 (guardian_notification_preferences). Safe to run twice.

begin;

do $$
begin
  if to_regprocedure('public.send_guardian_push(uuid, text, text, jsonb)') is null then
    raise exception 'Preflight failed: send_guardian_push() is missing.';
  end if;

  if to_regclass('public.guardian_notification_preferences') is null then
    raise exception 'Preflight failed: run migration 20261015 first (guardian_notification_preferences is missing).';
  end if;

  if to_regclass('public.geofence_events') is null then
    raise exception 'Preflight failed: geofence_events is missing.';
  end if;

  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Preflight failed: the supabase_realtime publication is missing.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. One Android channel (sound) per alert type
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

  v_channel := case
    when v_type in ('sos', 'sos_realert') then 'safetrack-sos'
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
      'body', p_body,
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

-- ---------------------------------------------------------------------------
-- 2. Live safety events in the app
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime' and pt.schemaname = 'public' and pt.tablename = 'geofence_events'
  ) then
    alter publication supabase_realtime add table public.geofence_events;
  end if;
end;
$$;

commit;
