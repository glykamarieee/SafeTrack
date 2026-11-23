-- INT-025: The guardian's notification settings decide which events are pushed.
-- "INT Push Test" was made with Safe Zone alerts on; "INT Push Test 2" after turning them off.
select g.name                                                                  as safe_zone,
       e.title                                                                 as event_recorded,
       to_char(e.occurred_at at time zone 'Asia/Manila', 'HH24:MI:SS')         as recorded_at,
       np.safe_zone                                                            as safe_zone_alerts_now
from geofence_events e
join geofences g on g.id = e.geofence_id
left join guardian_notification_preferences np on np.guardian_id = g.guardian_id
where g.name like 'INT Push Test%'
order by e.occurred_at;
