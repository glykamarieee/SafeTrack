-- SOS re-alert push shows which re-alert it is (CASE-102), 2026-11-12.
--
-- notify_guardian_of_sos() (trigger sos_alerts_notify_guardian) was created
-- outside these migrations. Two changes:
--   1. The re-alert push says "SOS re-alert #2 from <child>" instead of
--      "SOS still active: <child>". The first alert's text is unchanged.
--   2. The push data also carries sos_alert_id and child_id. send_guardian_push()
--      looks the alert up by those names to add "Near: <place>", and the app's
--      own notifications use them too; the trigger only sent sosAlertId and
--      childId, so an SOS push never showed the place. The old names stay.
--
-- Run once in the Supabase SQL editor. Safe to run again.

begin;

do $$
begin
  if to_regprocedure('public.send_guardian_push(uuid, text, text, jsonb)') is null then
    raise exception 'send_guardian_push(uuid, text, text, jsonb) is missing; nothing was changed.';
  end if;
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.sos_alerts'::regclass
      and t.tgname = 'sos_alerts_notify_guardian'
      and t.tgfoid = 'public.notify_guardian_of_sos()'::regprocedure
  ) then
    raise exception 'Trigger sos_alerts_notify_guardian does not call notify_guardian_of_sos(); nothing was changed.';
  end if;
end;
$$;

create or replace function public.notify_guardian_of_sos()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_child_name text;
begin
  select coalesce(p.full_name, 'Your child')
  into v_child_name
  from public.persons p
  where p.id = new.child_id;

  v_child_name := coalesce(v_child_name, 'Your child');

  if tg_op = 'INSERT' then
    if new.status = 'active' then
      perform public.send_guardian_push(
        new.guardian_id,
        case when new.is_test then 'SafeTrack test SOS' else 'SOS from ' || v_child_name end,
        v_child_name || ' sent an SOS alert. Open SafeTrack to respond.',
        jsonb_build_object(
          'type', 'sos',
          'sosAlertId', new.id,
          'childId', new.child_id,
          'sos_alert_id', new.id,
          'child_id', new.child_id,
          'latitude', new.latitude,
          'longitude', new.longitude
        )
      );
    end if;
  elsif new.status = 'active' and new.realert_count > old.realert_count then
    perform public.send_guardian_push(
      new.guardian_id,
      'SOS re-alert #' || new.realert_count || ' from ' || v_child_name,
      v_child_name || '''s SOS alert has not been acknowledged yet. Open SafeTrack to respond.',
      jsonb_build_object(
        'type', 'sos_realert',
        'sosAlertId', new.id,
        'childId', new.child_id,
        'sos_alert_id', new.id,
        'child_id', new.child_id,
        'realertCount', new.realert_count
      )
    );
  end if;

  return null;
end;
$function$;

revoke all on function public.notify_guardian_of_sos() from public, anon, authenticated;

commit;
