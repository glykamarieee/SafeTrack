-- SafeTrack FINAL smartwatch integration.
-- Safe/non-destructive: preserves the existing final tables and only ensures
-- the two runtime columns already present in the current SafeTrack schema.

alter table public.smartwatch_devices
  add column if not exists last_seen_at timestamptz null;

alter table public.smartwatch_devices
  add column if not exists device_token_hash text null;

create index if not exists idx_smartwatch_devices_watch_id
  on public.smartwatch_devices (watch_id);

create index if not exists idx_location_logs_child_recorded_at
  on public.location_logs (child_id, recorded_at desc);

create index if not exists idx_geofence_events_child_occurred_at
  on public.geofence_events (child_id, occurred_at desc);

create index if not exists idx_sos_alerts_child_status_triggered_at
  on public.sos_alerts (child_id, status, triggered_at desc);

-- Do not grant direct INSERT/UPDATE rights from the smartwatch to these tables.
-- The watch writes through protected Edge Functions using a server-side
-- service-role client after validating x-watch-id + x-device-token.
