-- CASE-367: outdoor walk and run with the real watch and phone (Nov 8, 2026, about 6:00-6:16 PM).
-- Read-only. The locations the real smartwatch saved during the walk, with the detected travel mode and speed.
select to_char(recorded_at at time zone 'Asia/Manila', 'HH24:MI:SS') as saved_at, travel_mode,
       round((speed_mps * 3.6)::numeric, 1) as speed_kmh, round(accuracy_meters::numeric) as accuracy_m
from location_logs
where source = 'smartwatch' and recorded_at between '2026-11-08 09:55+00' and '2026-11-08 10:20+00'
order by recorded_at limit 22;
