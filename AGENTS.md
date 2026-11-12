# SafeTrack: agent knowledge base

Read this before answering or changing anything. It records how the system
actually works and the traps already hit. If the code disagrees with this file,
trust the code and update this file in the same change.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## What SafeTrack is

Child-safety tracking app. Three kinds of user:

- **Guardian**: registers children, sees their location, safe zones and SOS alerts.
- **Administrator**: manages guardians and smartwatches.
- **Child**: tracked through a Wear OS **smartwatch** (separate app, not in this
  repo: `C:\SAFETRACK-FINAL\safe-track-wear-os`, Kotlin + Compose for Wear OS), an Android/iOS **phone** running this app in child mode, or both.

**Two projects only:**

```
C:\SAFETRACK-FINAL\
  safe-track\           this repo (github.com/glykamarieee/SafeTrack)
    app/ components/ services/ store/ hooks/   Expo app (guardian, child phone, admin)
    supabase/            migrations + edge functions
    ai-service/          Python FastAPI anomaly service (runs separately; see "AI service")
  safe-track-wear-os\   watch app repo (github.com/glykamarieee/SafeTrack-Wear-Os)
```

The old standalone `safe-track-ai` folder was merged into `ai-service/` on
2026-10-15 and deleted.

Stack: Expo 57 / React Native 0.86 / expo-router, Zustand stores, Supabase
(Postgres, Auth, Storage, Edge Functions). Supabase project ref `evffpbkxnjpizwqsrlqx`.

## Repository map

| Path | Contents |
|---|---|
| `app/(auth)` | Login, registration, child registration, child-phone link screen |
| `app/(app)` | Guardian and admin screens (one Tabs layout; hidden tabs use `href: null`) |
| `app/(child)` | Child-phone dashboard (home, safety, SOS, profile) |
| `services/` | All Supabase access. Screens should call services, not Supabase directly |
| `store/` | Zustand stores (`authStore`, `childMobileStore`, ...) |
| `supabase/migrations/` | Schema changes, applied by hand in the SQL Editor (see below) |
| `supabase/functions/` | The few remaining edge functions |
| `ai-service/` | Python FastAPI AI service, tests, model, Dockerfile; has its own README |
| `hooks/` | `useGuardianPushRegistration`, `useGuardianSosRealtime` (used by `app/(app)/_layout.tsx`) |

Every file under `app/` is a route: an empty or export-less file breaks the
router ("missing the required default export"). Every screen in `app/(app)` must
be listed in `app/(app)/_layout.tsx`; a screen that isn't listed appears as an
extra tab labelled with its file name. Non-tab screens use `options={{href:null}}`.

## Data model (identity is consolidated on `persons`)

- **`persons`**: one row per human (guardian, admin, child). For anyone who can log
  in, `persons.id = persons.auth_user_id = auth.uid()`; a check constraint enforces
  it, so `guardian_id = auth.uid()` is a valid ownership test. Children have
  `auth_user_id = null` and carry `age` and `tracking_source`.
- **`person_roles` + `roles`**: role codes `GUARDIAN`, `ADMIN`, `CHILD`. Roles live
  only here (there is no `persons.role`).
- **`person_relationships`**: guardian to child link. Each child has at most one
  active primary guardian (unique partial index).
- **`children` view**: read model (`id, guardian_id, full_name, age, relationship,
  tracking_source, avatar_path, created_at, updated_at`); active children only.
  `security_invoker`, so RLS applies. Read-only: write through RPCs.
- **Children are soft-deleted** (`persons.is_active = false`) so their history keeps
  a valid owner. Use `delete_my_child`, never a hard delete.
- Every `child_id` / `guardian_id` column has a foreign key to `persons(id)`.
- **Removed. Do not reintroduce:** `guardian_profiles`, `child_profiles`,
  `system_administrators`, `device_connection_codes`, and all `*_person_id`
  duplicate columns (`child_person_id` survives only on `person_relationships`).
- Safety events (safe-zone `entry`/`exit`, `watch_disconnected`,
  `prolonged_inactivity`, `possible_anomaly`) are all rows of `geofence_events`.
  There is no `safety_events` table to read from; the guardian Activity
  history loads through `services/activityHistoryService.ts` (see "Activity
  History").
- `tracking_source` is `smartwatch`, `mobile` or `both`. **Mobile-only children are
  allowed.**

## Where server logic lives

Prefer **Postgres functions called with `supabase.rpc()`** over edge functions.
Guardian-facing functions check ownership with `is_guardian_of(child_id)`; admin
ones use `is_current_safetrack_admin()`.

Key RPCs:

- **Guardian:**
  - `ensure_guardian_profile`, `update_my_person_profile`
  - `register_my_child`, `update_my_child_profile`, `delete_my_child`
  - `link_watch_to_my_child`, `unlink_watch_from_my_child`
  - `generate_watch_pairing_code`, `generate_child_phone_code`
  - `register_my_push_token`
  - `delete_my_account` (soft delete; `20261015_accounts_notifications_fixes.sql`)
  - `get_my_child_safety_timeline`, `acknowledge_my_sos_alert`
  - `get_my_child_activity_days` (History calendar; `20261014_child_activity_days.sql`)
  - `request_child_live(p_child_id, p_seconds)` (live map; `20261108_live_stream.sql`)
- **Child phone** (callable by `anon`; authenticated by a device token inside the function):
  - `pair_child_phone`
  - `get_child_phone_state`
  - `record_child_phone_location`
  - `push_child_phone_live` (live map, not saved; `20261108_live_stream.sql`)
  - `trigger_child_phone_sos`, `realert_child_phone_sos`
  - `unlink_child_phone`
- **Smartwatch** (callable by `anon`; authenticated by Watch ID + device token inside
  the function; `20260929_watch_rpc.sql`):
  - `pair_watch`
  - `record_watch_heartbeat`, `record_watch_location`
  - `trigger_watch_sos`
  - `push_watch_live` (live map, not saved; `20261108_live_stream.sql`)
  - `cancel_watch_sos` (migration 20261017b): the child's "Sent by mistake";
    cancels only that child's *active* SOS and pushes the guardian
    (`type: sos_cancelled`)
- **Admin:**
  - `get_admin_summary_metrics`
  - `get_admin_guardian_accounts`, `get_admin_guardian_detail`, `update_admin_guardian_account_status`
  - `get_admin_smartwatch_devices`, `get_admin_smartwatch_device_detail`, `update_admin_smartwatch_device_status`
  - `get_admin_report_summary`
- **Internal / service role:**
  - `create_child_person`, `find_or_register_watch`
  - `watch_device`, `touch_watch`, `insert_watch_location`
  - `process_safe_zone_events`, `safe_zone_status`
  - `send_guardian_push`

Only these **edge functions** remain, each for a reason SQL cannot cover:

- `generate-report` (admin JWT; identity is matched on `persons.auth_user_id` only,
  never by email). Builds the PDF (pdf-lib) and Excel (SheetJS) files itself in
  `generate-report/render.ts`, uploads them to the private `activity-reports`
  bucket, records them in `activity_reports` and returns a 1-hour signed URL.
  Rows are paged 1000 at a time (PostgREST's cap) up to 5000 per record type;
  the rest is counted and named in the report. The .NET GemBox `report-service/`
  is no longer called (it needed public hosting and a paid licence);
  `REPORT_SERVICE_URL`/`REPORT_SERVICE_KEY` are unused.
- `scheduled-safety-scan` notices: "watch disconnected" (no contact for
  `WATCH_DISCONNECT_SECONDS`, default 300) and "prolonged inactivity" (online
  but no location for `PROLONGED_INACTIVITY_SECONDS`, default 1800).
  - Each is created **once per episode**, counted from the watch's last
    contact or location.
  - While the episode continues, a reminder at most every
    `RULE_ALERT_REMINDER_SECONDS` (default 12 h).
  - Before 2026-10-15 an hourly cooldown repeated "watch disconnected" every
    hour while a watch was off, which would have pushed the guardian all night.
- `sos-realert`, `scheduled-safety-scan`, `anomaly-detection`: server-only jobs
  authenticated with `x-cron-secret` (`verify_jwt = false`). The scan runs the
  advisory AI review of each watch's newest location (tracked by
  `smartwatch_devices.last_ai_review_at`), since the watch functions cannot call it.
  `anomaly-detection` reviews one `{childId, locationLogId}` on demand; the app
  does not call it.

**AI service** (`ai-service/`, FastAPI, Python 3.13; full instructions in
`ai-service/README.md`). It runs as its own process or container, never inside
the Expo app.

- **How it is called:** `_shared/anomaly.ts` (used by `scheduled-safety-scan` and
  `anomaly-detection`) calls `POST {AI_SERVICE_URL}/score` only when
  `AI_ENABLED=true`, with header `X-SafeTrack-AI-Key: {AI_SERVICE_KEY}`. It only
  calls once a child has 100+ earlier points spanning 14+ days, and sends at most
  one notice per 15 minutes. It never reviews a point inside one of the child's
  enabled safe zones.
- **What `/score` checks:**
  - Every data endpoint is rejected unless the same `AI_SERVICE_KEY` is set in
    the service's own environment (it holds the service-role key).
  - The current point must be valid, otherwise it returns 422.
  - Only strictly earlier history is used, thinned to one point per 3 minutes
    (`thinHistory` in `_shared/anomaly.ts`, the spacing the model was trained on;
    10-second points would turn GPS jitter into speed spikes), at most 500 points.
- **Result:** a notice is written to `geofence_events` (`possible_anomaly`, with
  the reasons in `details`), and the push trigger notifies the guardian.
- **Features:** distance, speed, the hour in **Philippine time** (UTC+8; changed
  from UTC on 2026-10-15), accuracy, interval, stationary and source. A saved
  model with a different feature count is treated as missing (`ready: false`).
- **Model:** retrained on 2026-11-02 from 1,274 `location_logs` rows (7 features,
  contamination 0.02). 1,244 of those rows came from two children, so retrain once
  more children have history. Only children with 100+ records over 14+ days are scored.
  `AI_SERVICE_KEY` is generated in `ai-service/.env`; the same value must be set
  as the edge functions' secret.
- **Commands** (in `ai-service/`):

  | Task | Command |
  |---|---|
  | Set up | `python -m venv .venv` and `.venv\Scripts\python -m pip install -r requirements-dev.txt` |
  | Test | `.venv\Scripts\python -m pytest -q` (21 tests; no Supabase needed) |
  | Run | `.venv\Scripts\python -m uvicorn app:app --port 8000` |
  | Retrain | `.venv\Scripts\python train_model.py` (reads all `location_logs` with the service key) |

- **Deployment:** hosted on **Render** (free plan) as `safetrack-ai`:
  - **URL:** `https://safetrack-ai-qigk.onrender.com`; region Singapore.
  - **Source:** branch `consolidation`, root `ai-service/`, Docker. It
    auto-deploys on push.
  - **Environment:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `AI_SERVICE_KEY`.
  - **Free-plan behaviour:** it sleeps after about 15 minutes idle, and the first
    request then takes up to about a minute.
  - **Checking the key:** at startup it logs `AI_SERVICE_KEY: length N,
    fingerprint XXXXXXXX` (non-reversible). Compare it with
    `python -c "import app"` run locally in `ai-service/`.
  - **Trap:** paste only the value into a host's settings, never
    `NAME=value`. A pasted `AI_SERVICE_KEY=` prefix made every request 401.
  - **Verified on 2026-10-15:** no key → 401, normal point → not flagged, 40 km
    jump → flagged with reasons, bad input → 422.
  - **Then:** set the edge function secrets `AI_SERVICE_URL`, `AI_SERVICE_KEY`
    and `AI_ENABLED=true`.
- **Live cron jobs:** `safetrack-sos-realert` and `safetrack-safety-scan` both run
  every minute (seen in `cron.job`, 2026-10-15).
- **Legacy, unused:** `watch-pair`, `watch-ingest`. The watch app switched to the
  smartwatch database functions; delete these once no deployed watch app uses them
  (`npx supabase functions delete <name>`). Device tokens use the same hash, so
  watches paired through them keep working.

## Devices and pairing

- **Watch:** a guardian links a Watch ID (`link_watch_to_my_child`), generates a
  6-digit code (`generate_watch_pairing_code`, hash stored in
  `smartwatch_devices.pairing_code_hash`), and the watch redeems it with `pair_watch`
  for a device token. One watch per child (`smartwatch_devices.child_id` is unique).
  Linking a different Watch ID releases the old watch; `unlink_watch_from_my_child`
  releases it with no replacement. Both clear the released watch's device token, so
  it gets a 403 and returns to its connection screen.
- **Child phone:** a guardian generates a code (`generate_child_phone_code`, stored in
  `child_mobile_devices`); the phone redeems the code alone with `pair_child_phone`
  and stores `{childId, deviceToken}` in AsyncStorage (`services/childMobileService.ts`).
  An invalid or revoked token raises SQLSTATE `28000`, and the app then returns to the
  link screen.
- **Watch API contract** (the smartwatch functions above; the Wear OS app calls them
  with the publishable key and named `p_*` parameters, so renaming a parameter
  breaks deployed watches): every call takes optional `p_battery_percent`,
  `p_network_type` (`Wi-Fi | LTE | No network | Unknown`) and `p_device_model`,
  stored on `smartwatch_devices`. Location inserts advance `last_location_at` (never
  backwards). A `trigger_watch_sos` whose `p_triggered_at` matches an existing alert
  for the child returns that alert (`duplicate: true`) instead of inserting: the
  watch resends a pending SOS until it gets an answer. Heartbeat and location return
  `safeZone` = `safe_zone_status()`. Failures carry a machine-readable `HINT`
  (`watch_not_registered`, `watch_not_linked`, `no_active_code`, `code_expired`,
  `code_invalid`, `invalid_location`, `device_unlinked`) that the watch maps to its
  messages. Only SQLSTATE `28000` (`device_unlinked`) makes the watch drop its token
  and return to its connection screen.
- **Watch IDs** are `ST-WATCH-` + 8 characters, derived on the watch and shown on
  its connection screen (alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ`). The first
  time a guardian links or registers a child with an unknown ID in that format,
  `find_or_register_watch` creates its `smartwatch_devices` row. Rows are never
  created from the watch side. Linking alone gives no data access: the watch must
  still redeem a connection code.
- **Watch codes and phone codes are different things.** A watch code cannot link a
  phone. The phone code comes from Edit Child Profile, "Generate Child Phone
  Connection Code" (tracking source Phone or Both).
- Codes: 6 digits, SHA-256 hex stored, valid for 10 minutes, single use; a new code
  replaces the previous one.

## Live location, travel mode and place details (migration 20261104)

- **Rates:** watch and child phone send a point about every 10 s while moving
  (each 15 m), one every 3 min when still; the watch switches to balanced-power
  fixes every 60 s after 2 min still, to every 5 s for 10 min after an SOS, and
  to every 1 s while a guardian has the map open (see Live position)
  (`LocationTracker.kt`, `services/childBackgroundLocation.ts`).
- **Live map:** `location_logs` is in the `supabase_realtime` publication; the
  location store adds each new row to the front of the recent history and also
  reads the newest row every 15 s as a fallback. The marker reaches each new
  point in 180 ms (`useGlide`, ease-out; it used to glide for the whole gap
  between fixes, about 1 s behind the child) and never goes past the newest
  real point, with a 10-minute trail (`components/location/footprints.ts`):
  small SafeTrack-green left/right foot prints (#15803D, dark #3DDC84; about
  55% of the first size since 2026-11-08) facing the direction of travel where
  the child walked (2.6 m apart) or ran (4.4 m, sneaker prints), GPS wobble
  smoothed, fading after 2 min, the newest pressing in (Mapbox `SymbolLayer`
  with the PNGs in `assets/map/`, made by `scripts/make_feet.py`; Leaflet
  inline SVG); a line for the current vehicle stretch.
- **Avatars (2026-11-08):** the child and "You" are drawn centred on the true
  position (`MarkerGlyph.tsx` `PersonGlyph`, `markerHtml.ts` `.st-person`) with
  a direction arrow and a breathing view cone where the person faces: the
  child's from the live fix (`heading_degrees`: GPS direction while moving,
  else the watch/phone compass, only while a guardian watches), the guardian's
  from the phone compass. Turns the short way round and subtracts the map's
  rotation (`mapBearing.ts`); hidden when unknown or older than 30 s. The
  guardian's own position is live (`services/myLocationService.ts`: GPS every
  ~1 s and the compass while a map is open, paused in the background) and the
  "You" chip shows "together" or the distance to the child; only "You" is
  nudged aside when the two overlap (`spreadOverlapping`).
- **Rotation:** two fingers on the phone map (Mapbox `rotateEnabled`, free) and
  Shift + drag/wheel on the web map (`leaflet-rotate@0.2.8`); a compass button
  (top right) appears while rotated and turns the map back to north.
- **Safe zone status** updates by itself (`hooks/useZoneCircles.ts`): entry/exit
  events are re-read every 20 s and on each saved record, and while the
  position is live, inside/outside follows it with an edge buffer (half the GPS
  accuracy, 5-20 m) and 2 agreeing readings. Alerts still come only from the server.
- **Safe zone size:** 30-5000 m (was 50; presets 30/50/100/200/500 m). The live
  database's check constraint `geofences_radius_meters_check` (not created by
  these migrations) is replaced by `20261108c_safe_zone_min_30m.sql`; until the
  user runs it a 30-49 m zone is refused by the server. The form warns when the
  radius is smaller than the child's location accuracy; 100 m suits Home.
- **Field-test log:** guardian app lines `[STLOG]` in logcat (`lib/testLog.ts`,
  `TEST_LOG`; `live` lines carry `delay`, `toSrv` (fix → server) and `fromSrv`
  (server → phone) in ms, `live-start` the time from opening the map to the
  first live fix, `latency` the average/p95/max of the last 30 fixes); watch `/sdcard/Android/data/com.safetrack.watch/files/safetrack-test.csv`
  (`LiveTestLog.kt`; off when `testlog.off` exists in that folder).
- **Live position (about 1 s, `20261108_live_stream.sql`):** while Home or
  Location is in front, `useChildLive` → `services/liveLocationService.ts` calls
  `request_child_live` every 15 s (`live_viewers.until` = now + 30 s) and joins
  the private Realtime topic `child-live:<child id>` (RLS on `realtime.messages`:
  only `is_guardian_of`). Right after asking, the app sends a "wake" on the
  public topic `live-wake:<child id>` (no data; repeated every 3 s up to 4 times
  until a live fix arrives). The watch (`LiveWake.kt`, one OkHttp WebSocket,
  heartbeat 25 s, back-off reconnect) and the phone (`listenForLiveWake` in
  `childBackgroundLocation.ts`) answer by calling `push_*_live` at once, so live
  starts in about 1 s instead of at their 20 s check (still kept as a
  fallback); a fake wake only costs one request, since the database decides
  whether anyone watches. While it answers `live: true` they take a fix every
  second and send every one (broadcast by `realtime.send`, nothing written to
  `location_logs`); only after 30 s still does the watch drop to one fix every
  5 s (a 5 m move, walking speed or a turn sends at once; the phone uses 2 m).
  A push slower than 1.5 s no longer holds back the next fix. Home and Location re-read the
  watch's battery and network every 15 s, on each saved record and from each live fix; push_watch_live stores them when they change (`20261108b_live_battery.sql`)
  (`hooks/useWatchStatus.ts`). Runs while the screen is in front with no tap needed;
  stops in the background and when the screen closes, restarts on return, and
  a failed renewal is retried every 15 s. `applyLiveFix` in the location store ignores drift
  within the accuracy while still (unless the new fix is clearly sharper), skips
  a coarse (> 50 m, or 3x worse) fix while a sharp one is recent and a jump
  faster than 25 m/s beyond both accuracies (until 3 fixes agree), changes the
  activity after 2 agreeing readings or at once when confidence ≥ 0.7, and never
  lets an older saved row pull the marker back. The watch and phone do not send
  a coarse fix right after a sharp one, never drop a fix while a push is on its
  way (the newest is sent next), and send a turn of 15-20° at once while still.
- **Travel mode:** `location_logs.speed_mps`, `heading_degrees`, `travel_mode`
  (`still | walking | running | vehicle | boat | unknown`; the bike mode was
  removed 2026-11-08: running is up to 5 m/s, faster or a detected bicycle is
  "vehicle", and old `biking` rows are read as vehicle by `normalizeMode`) and
  `mode_confidence`, written by `record_watch_location_v2` /
  `record_child_phone_location_v2` (wrappers that call the unchanged originals,
  so old watches and phones keep working; the apps fall back to the originals
  until the migration runs). Speed bands in `lib/travelMode.ts` and
  `TravelMode.kt`; the watch adds Android Activity Recognition (optional
  "Physical activity" permission). Cars, jeeps and motorcycles are all
  "In a vehicle": GPS cannot tell them apart. "Boat" is decided in the guardian
  app when a moving point is over water.
- **Place details:** `lib/places.ts` reverse-geocodes with OpenStreetMap
  Nominatim (free; one request per second; results stored under the ODbL with
  "© OpenStreetMap contributors" credited in Help & Support and the map's ⓘ,
  not on each card). Where OpenStreetMap has no street (inside
  subdivisions), the street comes from Mapbox Geocoding v6 (`mapboxAddress`,
  4 s timeout, free allowance); those places are marked `mapbox` and kept in
  memory only, never saved to `location_places` (Mapbox's terms). Inside a
  safe zone the card shows the guardian's zone name first (`zoneName`). Cached per ~55 m cell in memory and in
  `location_places` (`location_cell()`, written with `save_location_place`).
  Fast (2026-11-08): the street/barangay/city show as soon as the first lookup
  answers and the landmark is added when the second does (`onPlaceChange`);
  until then the nearest known neighbouring cell is shown as "Near …"
  (`nearbyPlace`); the cell ~60 m ahead of a moving child is looked up early
  when no other lookup waits (`prefetchAhead`).
  Shown by `PlaceDetailsCard` (Home, Location), `PlaceLine` (SOS alerts, History
  sheets), admin Records (cached only) and the report exports; SOS and safe-zone
  pushes add "Near: …" when the spot is already cached. Never a guessed address:
  "Address unavailable" plus coordinates.
- **Selected child:** `hooks/useSelectedChild.ts` + `components/common/ChildSwitcher.tsx`
  are shared by Home, Location, Safety (SOS alerts), Notifications, AI notices,
  Safe Zones and History; `sosStore.activeAll` holds every child's active SOS for
  the Home banner and the switcher dots.

## Maps

Every map is `components/location/SafeTrackInteractiveMap.tsx`: the Home card
and Location (through `LocationMapCard`), Safe Zones, History, and the History
event sheet. No admin screen has a map.

**Engines** (same props, `MapEngineHandle` in `mapTypes.ts`):

| Platform | File | Engine |
|---|---|---|
| Android/iOS build | `MapboxRenderer.tsx` | Mapbox Maps SDK (`@rnmapbox/maps`) |
| Expo Go | `ExpoGoMapRenderer.tsx` | `react-native-maps` (Google on Android with Expo's key, Apple on iOS): Expo Go has no Mapbox native code |
| Web | `MapRenderer.web.tsx` | Leaflet in an iframe (`leafletHtml.ts`): Mapbox raster tiles when `EXPO_PUBLIC_MAPBOX_TOKEN` is set, keyless Esri tiles otherwise |

`MapRenderer.tsx` picks the native renderer with `mapSupport.ts` and
`require`s it lazily (importing Mapbox in Expo Go would fail). A build without
a token shows "Map token missing" instead of a blank map.

- **Shell vs engine:** the shell (`SafeTrackInteractiveMap.tsx`) owns the
  controls, sheets, zone tap detection, guardian marker, accuracy circles,
  zone centre chips and overlap spreading. Engines only draw and report taps
  and camera changes. Overlays use `pointerEvents="box-none"`.
- **Camera:** fit once, when content first arrives; afterwards the camera moves
  only on Fit, Focus, Zoom, My location or a `focus`/`recenterSignal` prop. Live
  updates move markers in place. Callers memoize their arrays, and the shell
  also skips content that is identical by value (`useStable`).
- **Zoom buttons:** ±1 level, clamped to 3–20, and fast taps add up (the next
  step starts from the pending target). Mapbox uses `Camera.zoomTo`;
  react-native-maps uses `getCamera()` + `animateCamera`. Leaflet ignores a zoom
  request while animating, so `leafletHtml.ts` queues it until `zoomend`.
- **Fitting:** Mapbox `fitBounds` padding is `[top, right, bottom, left]` and
  includes `mapPadding`; react-native-maps' Android `fitToCoordinates` takes
  physical pixels (multiplied by `PixelRatio`).
- **Scrolling:** screens with a map use `MapAwareScrollView`
  (`MapScrollLock.tsx`). It disables the page scroll while a finger is on the
  map, so drags and pinches move the map. Mapbox also gets
  `requestDisallowInterceptTouchEvent`. Web: the Leaflet iframe keeps its own
  events, so wheel and drag never scroll the page.
- **Logo and attribution:** Mapbox's terms require both to stay visible. On
  native they sit at the bottom-left, lifted by `mapPadding`;
  `LocationMapCard` passes `{bottom: 96}` for its info card. On web the Leaflet
  attribution sits at the bottom-left, and overlays leave it free.
- **Styles:** Mapbox `streets-v12` (Default), `dark-v11` (Default with the dark
  theme), `satellite-v9` / `satellite-streets-v12` (Satellite without/with
  labels) and `outdoors-v12` (Terrain). The web uses the same styles as raster
  tiles. `mapStyles.ts` holds the Google light and dark styles, used only by the
  Expo Go preview.
- **Layers sheet:** Default/Satellite/Terrain thumbnails (keyless Esri tiles),
  plus Traffic, Labels on satellite, Safe Zones, Route, and the Light/Dark/Auto
  theme (Auto = dark from 6 pm to 6 am). The app is pinned to light mode, so the
  system scheme isn't used. Saved in AsyncStorage (`mapPrefs.ts`, inside
  try/catch) and shared by all maps. Traffic is Mapbox's
  `mapbox.mapbox-traffic-v1` vector tiles coloured by congestion (Google's
  traffic layer in Expo Go); it is off on web.
- **Markers:** `MarkerGlyph.tsx` (native views) and `markerHtml.ts` (web HTML)
  must look alike. Kinds:

  | Kind | What it is |
  |---|---|
  | `child` | Photo or coloured initials, a ring, and source and battery badges |
  | `guardian` | "You" (from expo-location; no prompt if permission was granted earlier) |
  | `replay` | Moving avatar during History replay |
  | `start` | Hollow start dot |
  | `end` | Filled latest pin |
  | `stop` | Numbered stop |
  | `event` | Coloured pin with an icon |
  | `zoneCenter` | Zone centre dot with a name chip |
  | `draft` | New zone centre while editing |

  - **Ring colour:** `childRing()` in `zoneCircles.ts` picks it:
    - red, pulsing: an active SOS
    - grey: the last update is more than 15 minutes old
    - green: inside a zone (latest server entry)
    - amber: outside (latest exit)
  - **Native rendering:** Mapbox draws markers as live React Native views
    (`MarkerView`), so photos and the SOS pulse just work. In Expo Go,
    react-native-maps snapshots markers into bitmaps, so `tracksViewChanges` is
    true only until the photo loads (or the look changes), and stays true while
    the SOS pulse runs.
  - **Overlap:** avatars closer than about 48 px at the current zoom are offset
    sideways (`spreadOverlapping`).
- **Photos:** `useAvatarUrl(path, knownUrl)` signs `profile-avatars` paths and
  caches them for 50 minutes. On native, expo-image caches by `cacheKey` = the
  storage path, because signed URLs change on every signing.
- **Sheets:**
  - **Marker sheet:** name, last seen, address, device, battery and network
    (watch values now, never historical), accuracy, Focus, and Directions (a
    Google Maps `dir` URL, which opens any maps app).
  - **Zone sheet:** opened by tapping inside a zone or on its chip. Shows the
    radius and the latest entry/exit time, with Edit when the zone is
    `editable` (calls `onZoneAction(id, "edit")`).
  - **Custom marker handling:** when a screen passes `onMarkerPress`, marker
    taps go there instead of the built-in sheet (History does this).
  - **Picking a point:** with `picking`, every tap (markers too) is reported to
    `onMapPress` and no sheet opens.
- Safe Zone colours come only from the server's latest `entry`/`exit`
  `geofence_events` row per zone (`components/location/zoneCircles.ts`),
  never from comparing positions on the client.

**Token and builds:**

- **Env var:** `EXPO_PUBLIC_MAPBOX_TOKEN` in `.env`, a Mapbox public token
  (`pk.…`), inlined at bundle time and used by the phone and web maps. Never use
  a secret (`sk.…`) token. Mapbox no longer needs a secret download token to
  fetch its SDK (`RNMAPBOX_MAPS_DOWNLOAD_TOKEN` is optional).
- **Native code:** `@rnmapbox/maps` is added by `app.config.ts` (which extends
  the static `app.json`). After adding the package or changing the token,
  rebuild with `npm run build:android`; `/android` is generated by prebuild and
  git-ignored. A token change alone also needs a new bundle, so restart with
  `npx expo start -c` in development.
- **Library version:** `@rnmapbox/maps` is pinned to **10.3.8** (Mapbox Maps
  SDK 11.23.1). 10.3.18 was tried on 2026-11-12: with its own SDK (11.33.0)
  the map never loads on the Android emulator ("Vertex shader active uniforms
  exceed GL_MAX_VERTEX_UNIFORM_VECTORS"), and it does not compile against
  11.23.1. Don't update it before the defense.
- **Mapbox account:** sign up at mapbox.com; Account → Tokens → the Default
  public token or a new one with the default public scopes. For the web, add
  URL restrictions to the token.
- **Expo Go vs build:**
  - Expo Go cannot load Mapbox. It previews with react-native-maps (Google on
    Android, Apple on iOS) and needs no token.
  - Dev and release builds use Mapbox.
- **Pricing** (mapbox.com/pricing, checked 2026-10):
  - Mobile Maps SDK: the first 25,000 monthly active users are free, then
    $4.00 per 1,000.
  - Web raster tiles come from the Static Tiles API, which has its own free
    monthly allowance; check the current number on the pricing page.
  - Mapbox may ask for a payment card to activate the free tier.
  - Without a token, the web map uses the keyless Esri tiles (Esri attribution
    must stay visible).

## Activity History

`app/(app)/history.tsx` ("Daily route history"):

- **Header:** a back button (navigates to Home explicitly), a child switcher
  when there are several children, and a date stepper. The date opens a
  calendar (`components/history/HistoryCalendar.tsx`) with dots on days that
  have records (red if there was an SOS).
- **Map:** the route, a hollow start, a filled latest pin, numbered stops,
  coloured event pins and Safe Zones.
- **Replay:** a slider with play/pause at 1×/4×/16×, where 1× is one recorded
  minute per second. The avatar is interpolated between records.
- **Stats:** each one opens an explanation of its calculation.
  - **Records:** stored records only.
  - **Distance:** `routeDistance` adds up straight lines between records, with
    two filters. A move counts only if it is larger than the two records' GPS
    accuracy added together (15–150 m); smaller moves are wobble while standing
    still. A record that would need more than 180 km/h is skipped as a glitch,
    unless the next record confirms the new place; the child then moves there,
    but the unknown path is not counted.
  - **Span:** from the first record to the latest one.
  - **Time in Safe Zones:** taken from server entry/exit pairs, including each
    zone's last event before midnight. Overlaps count once, turned-off zones
    are excluded, and an open stay counts to the end of the day (or now, for
    today).
  - **SOS:** the count of alerts, with how many are still active.
- **Stops:** estimated by `estimateStops`: records that stay within 60 m for at
  least 5 minutes.
- **Safety timeline:** filter chips (SOS, Safe Zones, Device, Inactivity, AI
  notices). Each event opens `EventSheet` with a mini map, Directions and,
  for an active SOS, Acknowledge (`acknowledge_my_sos_alert`).
- **States:** pull-to-refresh, skeletons on first load, an empty day, an
  error card with Retry, and a per-part problems banner.
- **Data:** everything goes through `services/activityHistoryService.ts`. The
  calendar uses `get_my_child_activity_days(p_child_id, p_from, p_to)`
  (`supabase/migrations/20261014_child_activity_days.sql`):
  - It returns per-day `location_count`, `event_count` and `sos_count` for at
    most 63 days.
  - It is `security definer`, checks `is_guardian_of`, and is granted to
    `authenticated` only.
  - Until that migration is applied, the calendar works without dots (PostgREST
    `PGRST202`).
- **No historical battery or network:** `location_logs` has no battery or
  network columns. Battery and network exist only as the watch's latest values
  on `smartwatch_devices`, so screens label them "now".

## Notifications

Guardian push notifications are sent **only by database triggers**. Never send
pushes from app or edge-function code: insert the row and the trigger does the
rest.

- **Server:**
  - `sos_alerts_notify_guardian` (function `notify_guardian_of_sos`; insert,
    and `realert_count` increase while active: "SOS re-alert #N from <child>",
    migration 20261112) and `geofence_events_notify_guardian` (every insert) call
    `send_guardian_push`.
  - `send_guardian_push` posts to Expo's push API through `pg_net`. Since
    migration 20261017 the Android channel depends on the type: `sos` and
    `sos_realert` → **`safetrack-sos-v2`** (SOS bells; `safetrack-sos` was the
    old siren, deleted by the app), `entry`/`exit` →
    **`safetrack-zones`** (chime), anything else → **`safetrack-alerts`**.
  - It skips categories the guardian turned off in
    `guardian_notification_preferences` (`safe_zone`, `anomaly`, `device`). **SOS
    and re-alerts are always sent.**
- **App:**
  - `useGuardianPushRegistration` (in `app/(app)/_layout.tsx`) asks for
    permission, creates the three channels (`services/alertNotifier.ts`
    `ensureAlertChannels`), gets an Expo token and
    calls `register_my_push_token`. Tapping a notification opens SOS Alerts,
    History or AI notices.
  - Logout switches the token off (`unregisterGuardianPushToken`).
  - While the app is open, `useGuardianSosRealtime` keeps SOS alerts live
    (Supabase Realtime on `sos_alerts`; needs `sos_alerts` in the
    `supabase_realtime` publication, added by migration 20261015).
  - The same hook shows new SOS, re-alerts and `geofence_events` (needs
    migration 20261017 for the publication) as **local** notifications on those
    channels while the app runs, including in the background. `notifyAlert`
    skips the local copy when the server push for it already arrived. Android
    pauses JS timers in the background, so once SafeTrack is closed or idle for
    a while only the server push arrives.
  - Channel sounds live in `assets/sounds` and reach `res/raw` through the
    expo-notifications plugin `sounds` option (needs prebuild). Android fixes a
    channel's sound at creation: a new sound needs a new channel id.
  - In-app sound effects: `lib/sounds.ts` `playSound()` (played with expo-video,
    no extra native module); `showAlert` plays success/error by title. On/off
    switch and test notification: Profile → Notifications.
- **Required configuration** (without it registration stops quietly and nothing
  is delivered):
  1. **Expo project ID:** run `npx eas init`, which writes
     `extra.eas.projectId` into `app.json`.
  2. **Firebase for Android:** create a Firebase project with Android package
     `com.amawachoya.SafeTrack`, and put `google-services.json` in the project
     root. `app.config.ts` adds it only when the file exists.
  3. **FCM key for Expo:** upload the Firebase service-account key (FCM V1) with
     `npx eas credentials`, under Android → Push Notifications.
  4. **Rebuild** the app. Expo Go cannot receive Android remote push.
- **Troubleshooting:**
  - `select count(*) from guardian_push_tokens where is_active;` should be at
    least 1 after a guardian logs in on a build.
  - If it stays 0, check the device log for `[SafeTrack push registration]`.
  - The token pattern in `register_my_push_token` and `send_guardian_push` must
    be `'^Expo(nent)?PushToken\[[^\]]+\]$'` with **single** backslashes;
    migration 20261015 rewrites both.

## Database rules that have bitten us

- Check constraints are enforced on insert and update. Use the exact values:
  - `sos_alerts.status`: `active | acknowledged | cancelled` (not `canceled`)
  - `sos_alerts.activation_method`: `tap_and_hold | tap_hold | manual_button | shake`
  - `geofence_events.event_type`: `entry | exit | possible_anomaly | watch_disconnected | prolonged_inactivity`
  - `location_logs.source`: `smartwatch | mobile`
- **RLS silently filters writes.** A client `update` on a table without an UPDATE
  policy affects 0 rows and returns no error (e.g. `smartwatch_devices`, `persons`).
  Guardian writes must go through a `security definer` RPC.
- Supabase's default privileges grant new functions to `anon`: always
  `revoke all ... from public, anon` and grant explicitly.
- `Alert.alert` is a no-op on web, and the admin module is used on web: use
  `showAlert` from `lib/platformAlert.ts` for any dialog, especially confirmations.
- Hidden screens live in the `(app)` Tabs navigator, where `router.back()` returns
  to the first tab; navigate to the intended screen explicitly.
- Postgres errors from `supabase-js` are plain objects, not `Error` instances: read
  `error.message`, never rely on `instanceof Error`.
- In React Native, `instanceof Response` fails; duck-type (`typeof x.json === "function"`).
- In `returns table (...)` plpgsql functions, output column names shadow table
  columns: always qualify columns with a table alias.

## Accounts

- **Registration:** `signUp` with `emailRedirectTo` = `authRedirectUrl("/login")`.
  Login then shows "Account created…". If Supabase requires email confirmation
  (dashboard: Authentication → Sign In / Providers → Email → "Confirm email"),
  login shows **Resend confirmation email** (`supabase.auth.resend`).
- **Email confirmation is ON** (since 2026-11-13; Supabase requires upper case, lower case, a digit and a symbol in passwords). Confirmation links open Login directly: `takeConfirmationNotice` (`lib/deepLinks.ts`) shows "Email confirmed…" or, for a refused link (`#error=…`), "already used or has expired". Email apps may open a link once before the guardian's tap, so a link that just confirmed the account can still arrive as "used".
- **Links after Android closed the app:** `plugins/withLinkIntent.js` makes MainActivity call `setIntent()` in `onNewIntent`; without it a reset or confirmation link that restarted SafeTrack reached JS as no link (`[SafeTrack link] launch none` in logcat) and the start screen opened.
- **Password reset:**
  - `resetPasswordForEmail` with `redirectTo` = `authRedirectUrl("/reset-password")`.
  - The `app/(auth)/reset-password.tsx` screen turns the link into a session
    (`startPasswordRecovery` handles both `#access_token…` and `?code=`) and
    saves the new password.
  - Every redirect URL must be allowed under Supabase → Authentication → URL
    Configuration → Redirect URLs: `safetrack://**`, the web origin, and for Expo
    Go `exp://**`.
- **Change password:** `app/(app)/change-password.tsx`, for guardians and admins.
  It re-checks the current password, then calls `updateUser`.
- **Delete account:** `app/(app)/delete-account.tsx` re-checks the password,
  then calls `delete_my_account()`, which:
  - removes each child exactly as `delete_my_child` does (unless another
    guardian is still linked),
  - turns off safe zones, deletes push tokens and preferences, deactivates
    roles,
  - blanks the name, email, phone and photo,
  - deletes auth sessions and sets `banned_until` (skipped if auth-schema
    writes are not allowed).

  Rows are never hard-deleted (RESTRICT foreign keys keep history owners).
  Login refuses inactive `persons` (`InactiveAccountError`), so a deleted or
  deactivated account can't be re-provisioned by `ensure_guardian_profile`.
- **Notification preferences:** `app/(app)/notification-settings.tsx` writes
  `guardian_notification_preferences` (RLS: own row only).

## Child phone location

- **Manual:** "Share latest location" sends one fix (`record_child_phone_location`).
- **Automatic (optional):** the child turns on "Share location automatically"
  (`components/location/AutoShareToggle.tsx`, `services/childBackgroundLocation.ts`).
  - It needs "Allow all the time" location access.
  - It runs as an Android foreground service with a visible notification, or the
    iOS background-location indicator.
  - Moving: a point about every 10 s (each 15 m), with speed and travel mode;
    still: one every 3 minutes.
  - It stops when the phone is unlinked.
  - The task is registered at startup (`app/_layout.tsx` imports the service).
  - It needs a build (`expo-location` background options in `app.json`, plus
    `expo-task-manager`); **not Expo Go or web**.
  - After a reboot it resumes when SafeTrack is next opened.
  - Not yet tested on a device. Google Play requires a background-location
    declaration before publishing.

## Administrator records

`app/(app)/admin-records.tsx` (the Records tab) lists SOS alerts, location records
and safety events for a date range, 50 per page, through
`services/adminRecordsService.ts`. These are plain selects allowed by the
`is_safetrack_admin()` SELECT policies, with child names read from `persons`.

## Design system (redesign, branch `redesign`)

- **Approved look:** green, white and a little "forest night" (`#0D2A1E`, never neutral black), Plus Jakarta Sans,
  Light by default with a full Dark theme (Profile → Appearance: Light / Dark / Match phone, saved on the device).
  Red only for SOS. Board: https://claude.ai/artifact/4h3Bh1nUEePYVT4YEnLQCE. Plan: `docs/redesign-plan.md`.
- **Tokens:** `theme/tokens.ts` (light/dark palettes, type, radii, motion, `stateColor`). Read colours with
  `useTheme()`, style with `makeStyles((c, scheme) => StyleSheet.create(...))`. Don't hard-code hex in new code.
- **Text:** import `Text`/`TextInput` from `components/ui/NativeText` (or the variant `Text` from `components/ui`).
  Android picks a custom font file by family, not `fontWeight`; NativeText maps the weight. React Native's own
  `Text` renders the system font on Android.
- **Old token files** (`constants/guardianDesign`, `safeTrackDesign`, `childDesign`, `adminDesign`, `theme`) still
  supply radius/spacing/shadow; their colours are mapped into the theme by `theme/legacy.ts`. A helper outside a
  component that reads them gets light-only colours: pass the themed colours in instead (see child-home
  `statusDetails`).
- **Primitives** (`components/ui`): Button (primary/forest/secondary/soft/ghost/danger/glass), Surface, Field,
  Notice, Chip, ChoiceCard, CodeInput, Steps, Segmented, StateRing, HoldRing, MapPattern, Entrance.
  `components/auth/AuthShell` is the sign-in layout; `components/navigation/SideNav` the wide-screen sidebar.
- **Motion** (`theme/motion.ts`): press feedback, entrance, pulse, drift. Everything respects Reduce Motion.
- **Location wording:** "Live" only when the newest point is under 30 seconds old (`isLive` in
  `lib/travelMode.ts`); otherwise "Updated X ago" / "Last seen X ago". Moving: watch and phone auto-share
  about every 10 s; still: every 3 min.
- **Onboarding:** `app/onboarding.tsx` (welcome guide on first launch of the phone app, guardian after first sign-in, child phone after linking; replay from
  Profile, Help & Support, child profile). Watch tour: `ui/tour/WatchTour.kt` after first pairing, replay from
  Status. Seen-flags: `safetrack.onboarding.<audience>` (AsyncStorage), `safetrack_watch_tour` (SharedPreferences).
- **Maps** follow the app's dark mode when the map theme is Auto (the default).

## Working in this repo

- **Environment:** `.env` holds `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (git-ignored). Without them `lib/supabase.ts`
  falls back to `placeholder.supabase.co`. `EXPO_PUBLIC_*` values are inlined at
  bundle time: restart with `npx expo start -c` after changing them. Optional
  map token: `EXPO_PUBLIC_MAPBOX_TOKEN` (see "Maps").
- **Unit tests write to the live database.** The Jest suites sign in as the
  unit-test guardian and add real rows for "UT Child One/Two" (locations at
  7.3, 125.4, SOS alerts, zone events) on every run; only `__tests__/places`
  is fully mocked. Run single folders, not the whole suite, unless needed.
  `ai-service/train_model.py` leaves those children out.
- **Type-check** the app with `npx tsc --noEmit -p .`. Deno, Docker and a global
  Supabase CLI are not installed, so edge functions cannot be type-checked locally.
- **Migrations are applied manually** in the Supabase SQL Editor, not with
  `db push`. Write each one as a single transaction with preflight checks so a
  failure changes nothing. Never edit a migration that has been applied; add a new
  one. The live schema can differ from `supabase/migrations` (older tables were
  created outside it). When unsure, ask the user to run an `information_schema` /
  `pg_policies` / `pg_proc` query rather than guessing.
- **Edge functions** are deployed with
  `npx supabase functions deploy <name> --project-ref evffpbkxnjpizwqsrlqx` after
  `npx supabase login`, which the user must run (`! npx supabase login`). SQL cannot
  deploy or delete edge functions.
- **The publishable key cannot read the schema** (`/rest/v1/` needs a secret key), so
  schema questions go through the user's SQL Editor.
- **Screens:** Edit Child Profile takes a `childId` route param; without it, it opens
  the guardian's first child (oldest), the same child the Home screen uses.
- **Builds:** `npm run build:android` runs prebuild, then Gradle `assembleRelease`
  (~15 minutes the first time). Needed after any native change: Mapbox, push
  notifications, background location, a new Expo module or `google-services.json`.
  JavaScript-only changes can be tested with `npx expo start -c`.
  - **Outputs:** phone APK `android/app/build/outputs/apk/release/app-release.apk`;
    watch APK `safe-track-wear-os/app/build/outputs/apk/release/app-release.apk`
    (`gradlew.bat assembleRelease`); admin web `npx expo export --platform web`
    → `dist/` (static files, host anywhere; admin signs in at `/login`).
  - Both apps sign release builds with the debug keystore: fine for installing
    the APK directly, not for the Play Store (create an upload keystore first).
  - Don't start Metro with `CI=1` while developing: it disables file watching,
    so code changes are not picked up until Metro restarts.
- **Wear OS app** (`C:\SAFETRACK-FINAL\safe-track-wear-os`): build and unit-test
  with `gradlew.bat assembleDebug testDebugUnitTest` (3 unit tests, passing on
  2026-10-15). Its RPC contract is under "Devices and pairing"; don't rename `p_*`
  parameters.
  - **Verified 2026-10-15 against the live database:** every parameter the watch
    sends to `pair_watch`, `record_watch_heartbeat`, `record_watch_location` and
    `trigger_watch_sos` is accepted (probed with an unknown Watch ID, which
    returns `watch_not_registered` / `device_unlinked`; a wrong parameter name
    returns `PGRST202`).
  - **Real-use evidence:** a Galaxy Watch (SM-L325F) has reported 600+
    locations plus battery and network, and SOS by both `shake` and
    `tap_and_hold`.
  - **Restart warning:** without "Allow all the time" location, monitoring
    can't restart after a reboot. The dashboard shows a warning card that
    reopens the permission screen, which falls back to app settings once
    Android stops asking.
- **Migrations waiting to be applied** (run in order in the SQL Editor, then
  confirm with the user):
  `20261014_child_activity_days.sql`, `20261015_accounts_notifications_fixes.sql`,
  `20261016_activity_reports_export_fix.sql` (the live `activity_reports` check
  constraints rejected `export_format = 'PDF'`, so admin PDF/Excel export failed).
  `20261016b_deleted_account_signin_fix.sql` (`delete_my_account` set
  `banned_until = 'infinity'`, which Supabase Auth cannot parse: signing in to
  a deleted account returned HTTP 500; now 2999-12-31, and old rows repaired).

## Known open issues

- Phone pairing codes are 6 digits and `pair_child_phone` is public: brute force
  within the 10-minute window is possible. Consider longer codes or attempt limits.
  `pair_watch` has the same exposure, limited to a known Watch ID.
- The child-phone device token is stored unencrypted (AsyncStorage);
  `expo-secure-store` is not installed.
- Because linking registers unknown Watch IDs, a guardian can claim a well-formed
  ID before its real owner does, and the owner then sees "already linked to
  another child profile". An admin must resolve it.
- **Auth emails:** sent through custom SMTP (Gmail App Password, set up on
  2026-10-15 under Authentication → Emails → SMTP Settings).
  - A **Send Email hook** (Authentication → Auth Hooks) pointed to an edge
    function `send-email-hook` that is **not in this repo** and returned 500, so
    every reset and confirmation email failed ("Unexpected status code returned
    from hook: 500" in Logs → Auth).
  - The hook was disabled on 2026-10-15. Keep it disabled, or the hook replaces
    SMTP entirely.
  - The deployed `send-email-hook` function can be deleted once nobody needs it
    (`npx supabase functions delete send-email-hook`).
  - Gmail is meant for personal mail (about 500 emails a day, may land in spam).
    Switch to a transactional sender such as Brevo or Resend for real use.
- **AI pipeline:** live since 2026-10-15.
  - Render hosts the service, the Supabase secrets are set (the
    `AI_SERVICE_KEY` digest starts `df5196dd`), and `AI_ENABLED=true` (it had
    been `false`).
  - All four edge functions were redeployed.
  - The first scan stamped `last_ai_review_at` within a minute.
  - Only one child currently has enough history to be scored.
- **Fixed in code; the database part takes effect once migration 20261015 is applied:**
  - **Open insert policy:** the `anomaly_events` INSERT policy of `true` for
    `public` is dropped.
  - **`admin_update_device_status`:** wrote a nonexistent `device_status` column;
    it now delegates to `update_admin_smartwatch_device_status`.
  - **`acknowledge_my_qr_assistance_alert`:** referenced a missing table; dropped.
  - **Missing SOS functions:** the app no longer calls `trigger_my_test_sos_alert`
    or `resolve_my_sos_alert` (the dead `ChildHome` and `components/sos/*` were
    removed).
  - **`safety_events`:** the anomaly service read this nonexistent table; it now
    reads `geofence_events`.
