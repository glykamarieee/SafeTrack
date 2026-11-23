-- INT-040: Saving locations, safe-zone events and SOS never waits for the AI service.
-- None of the functions the watch and phone call contain a web request; only the
-- scheduled safety scan (a separate job) calls the AI service.
select p.proname                                                  as function_called_by_device,
       pg_get_functiondef(p.oid) ~* 'http|onrender|net\.'        as calls_a_web_service
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('record_watch_location', 'record_watch_location_v2', 'trigger_watch_sos',
                    'record_child_phone_location', 'record_child_phone_location_v2', 'trigger_child_phone_sos')
order by 1;
