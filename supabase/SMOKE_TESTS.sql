-- SafeTrack FINAL post-migration read-only checks.
-- Run in Supabase SQL Editor after 20260919_full_integration.sql.

-- 1) Required watch runtime/pairing columns.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'smartwatch_devices'
  and column_name in (
    'last_seen_at',
    'device_token_hash',
    'pairing_code_hash',
    'pairing_code_expires_at',
    'pairing_code_created_at',
    'last_battery_percent',
    'last_network_type',
    'device_model',
    'last_location_at',
    'last_ai_review_at'
  )
order by column_name;

-- 2) Verify anomaly/rule notices can exist without a specific geofence.
select table_name, column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'geofence_events'
  and column_name = 'geofence_id';

-- 3) Confirm the private report bucket exists.
select id, name, public
from storage.buckets
where id = 'activity-reports';

-- 4) Current smartwatch runtime status.
select
  id,
  watch_id,
  child_id,
  is_active,
  paired_at,
  last_verified_at,
  last_seen_at,
  last_location_at,
  last_ai_review_at,
  last_battery_percent,
  last_network_type,
  device_model
from public.smartwatch_devices
order by updated_at desc;

-- 5) Recent location / rule / AI / SOS records.
select id, child_id, source, latitude, longitude, accuracy_meters, recorded_at
from public.location_logs
order by recorded_at desc
limit 20;

select id, child_id, geofence_id, event_type, title, details, anomaly_score, occurred_at
from public.geofence_events
order by occurred_at desc
limit 20;

select id, child_id, guardian_id, activation_method, status, triggered_at,
       acknowledged_at, realert_count, last_realert_at
from public.sos_alerts
order by triggered_at desc
limit 20;
