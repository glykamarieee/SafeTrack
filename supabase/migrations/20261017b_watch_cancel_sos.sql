-- SafeTrack: the child can cancel an SOS sent by mistake from the watch (2026-10-17)
--
-- cancel_watch_sos(): called by the Wear OS app from the "SOS sent" screen
-- ("I'm OK – sent by mistake"). Authenticated like the other watch functions
-- (Watch ID + device token, SHA-256 hex in smartwatch_devices.device_token_hash).
--
-- - Only an *active* SOS of the watch's own child can be cancelled; it becomes
--   'cancelled', which also stops the sos-realert re-alerts.
-- - Every guardian row of that SOS (same child and triggered_at) is cancelled,
--   and each guardian gets a push: "<child> cancelled the SOS".
-- - Already acknowledged or cancelled: nothing changes; returns its status.
-- - Takes the optional p_battery_percent / p_network_type / p_device_model that
--   every watch call sends (accepted, not stored here).
--
-- Errors carry a HINT the watch understands: device_unlinked (SQLSTATE 28000,
-- the watch returns to its connection screen) and sos_not_found.

begin;

do $$
begin
  if to_regclass('public.smartwatch_devices') is null
     or to_regclass('public.sos_alerts') is null
     or to_regclass('public.persons') is null then
    raise exception 'Preflight failed: smartwatch_devices, sos_alerts or persons is missing.';
  end if;

  if to_regprocedure('public.send_guardian_push(uuid, text, text, jsonb)') is null then
    raise exception 'Preflight failed: send_guardian_push() is missing.';
  end if;
end;
$$;

create or replace function public.cancel_watch_sos(
  p_watch_id text,
  p_device_token text,
  p_sos_alert_id uuid,
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
  v_alert public.sos_alerts%rowtype;
  v_child_name text;
  v_row record;
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

  select * into v_alert
  from public.sos_alerts a
  where a.id = p_sos_alert_id
    and a.child_id = v_device.child_id;

  if not found then
    raise exception 'SOS alert not found for this watch.'
      using errcode = 'P0002', hint = 'sos_not_found';
  end if;

  if v_alert.status <> 'active' then
    return jsonb_build_object('ok', true, 'status', v_alert.status, 'changed', false);
  end if;

  select coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Your child')
  into v_child_name
  from public.persons p
  where p.id = v_device.child_id;

  for v_row in
    update public.sos_alerts a
    set status = 'cancelled'
    where a.child_id = v_device.child_id
      and a.status = 'active'
      and (a.id = v_alert.id or a.triggered_at = v_alert.triggered_at)
    returning a.id, a.guardian_id
  loop
    if v_row.guardian_id is not null then
      perform public.send_guardian_push(
        v_row.guardian_id,
        coalesce(v_child_name, 'Your child') || ' cancelled the SOS',
        coalesce(v_child_name, 'Your child') || ' says the SOS was sent by mistake. Check in when you can.',
        jsonb_build_object('type', 'sos_cancelled', 'sos_alert_id', v_row.id, 'child_id', v_device.child_id)
      );
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'status', 'cancelled', 'changed', true);
end;
$function$;

comment on function public.cancel_watch_sos(text, text, uuid, integer, text, text) is
  'Watch: cancel the child''s own active SOS (sent by mistake). Authenticated by Watch ID + device token.';

revoke all on function public.cancel_watch_sos(text, text, uuid, integer, text, text) from public;
grant execute on function public.cancel_watch_sos(text, text, uuid, integer, text, text) to anon, authenticated;

commit;
