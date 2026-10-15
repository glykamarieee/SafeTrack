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
- **Child phone** (callable by `anon`; authenticated by a device token inside the function):
  - `pair_child_phone`
  - `get_child_phone_state`
  - `record_child_phone_location`
  - `trigger_child_phone_sos`, `realert_child_phone_sos`
  - `unlink_child_phone`
- **Smartwatch** (callable by `anon`; authenticated by Watch ID + device token inside
  the function; `20260929_watch_rpc.sql`):
  - `pair_watch`
  - `record_watch_heartbeat`, `record_watch_location`
  - `trigger_watch_sos`
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
  one notice per 15 minutes.
- **What `/score` checks:**
  - Every data endpoint is rejected unless the same `AI_SERVICE_KEY` is set in
    the service's own environment (it holds the service-role key).
  - The current point must be valid, otherwise it returns 422.
  - Only strictly earlier history is used, sorted, at most 500 points.
- **Result:** a notice is written to `geofence_events` (`possible_anomaly`, with
  the reasons in `details`), and the push trigger notifies the guardian.
- **Features:** distance, speed, the hour in **Philippine time** (UTC+8; changed
  from UTC on 2026-10-15), accuracy, interval, stationary and source. A saved
  model with a different feature count is treated as missing (`ready: false`).
- **Model:** retrained on 2026-10-15 from 652 `location_logs` rows (7 features).
  624 of those rows came from one child, so retrain once more children have
  history. Only children with 100+ records over 14+ days are scored.
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
  - `sos_alerts_notify_guardian` (insert, and `realert_count` increase while
    active) and `geofence_events_notify_guardian` (every insert) call
    `send_guardian_push`.
  - `send_guardian_push` posts to Expo's push API through `pg_net`, using Android
    channel **`safetrack-alerts`**.
  - It skips categories the guardian turned off in
    `guardian_notification_preferences` (`safe_zone`, `anomaly`, `device`). **SOS
    and re-alerts are always sent.**
- **App:**
  - `useGuardianPushRegistration` (in `app/(app)/_layout.tsx`) asks for
    permission, creates the `safetrack-alerts` channel, gets an Expo token and
    calls `register_my_push_token`. Tapping a notification opens SOS Alerts,
    History or AI notices.
  - Logout switches the token off (`unregisterGuardianPushToken`).
  - While the app is open, `useGuardianSosRealtime` keeps SOS alerts live
    (Supabase Realtime on `sos_alerts`; needs `sos_alerts` in the
    `supabase_realtime` publication, added by migration 20261015).
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
  - It saves at most every 5 minutes, unless the phone moved 100 m.
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

## Working in this repo

- **Environment:** `.env` holds `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (git-ignored). Without them `lib/supabase.ts`
  falls back to `placeholder.supabase.co`. `EXPO_PUBLIC_*` values are inlined at
  bundle time: restart with `npx expo start -c` after changing them. Optional
  map token: `EXPO_PUBLIC_MAPBOX_TOKEN` (see "Maps").
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
  `20261014_child_activity_days.sql`, `20261015_accounts_notifications_fixes.sql`.

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
- Guardian screens other than History still show only the oldest child
  (`linkedChildren[0]`).
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
