-- INT-040: with the AI service unreachable (AI_SERVICE_URL pointed at an offline host from 2026-11-24T20:06:59Z UTC),
-- the child phone's location and SOS were still saved. Read-only.
select 'location' as record, to_char(l.recorded_at at time zone 'Asia/Manila','HH24:MI:SS') as saved_at, l.travel_mode as detail
  from location_logs l where l.child_id = (select id from persons where full_name='UT Child Two' and is_active) and l.created_at >= '2026-11-24T20:06:59Z'
union all
select 'SOS alert', to_char(a.created_at at time zone 'Asia/Manila','HH24:MI:SS'), a.status
  from sos_alerts a where a.child_id = (select id from persons where full_name='UT Child Two' and is_active) and a.created_at >= '2026-11-24T20:06:59Z'
order by 2;
