-- Safe zones may now be as small as 30 m (was 50 m), 2026-11-08.
--
-- The live database refuses a 30 m zone with
--   new row for relation "geofences" violates check constraint
--   "geofences_radius_meters_check"
-- That constraint was created outside these migrations; it is replaced here
-- with the range the app now allows: 30 to 5000 meters.
--
-- Run once in the Supabase SQL editor (or supabase db push). Safe to run again.

alter table public.geofences
  drop constraint if exists geofences_radius_meters_check;

alter table public.geofences
  add constraint geofences_radius_meters_check
  check (radius_meters >= 30 and radius_meters <= 5000);
