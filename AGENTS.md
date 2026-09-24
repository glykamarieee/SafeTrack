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
  repo), an Android/iOS **phone** running this app in child mode, or both.

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
  - `link_watch_to_my_child`
  - `generate_watch_pairing_code`, `generate_child_phone_code`
  - `register_my_push_token`
  - `get_my_child_safety_timeline`, `acknowledge_my_sos_alert`
- **Child phone** (callable by `anon`; authenticated by a device token inside the function):
  - `pair_child_phone`
  - `get_child_phone_state`
  - `record_child_phone_location`
  - `trigger_child_phone_sos`, `realert_child_phone_sos`
  - `unlink_child_phone`
- **Admin:**
  - `get_admin_summary_metrics`
  - `get_admin_guardian_accounts`, `get_admin_guardian_detail`, `update_admin_guardian_account_status`
  - `get_admin_smartwatch_devices`, `get_admin_smartwatch_device_detail`, `update_admin_smartwatch_device_status`
  - `get_admin_report_summary`
- **Internal / service role:**
  - `create_child_person`
  - `process_safe_zone_events`, `safe_zone_status`
  - `send_guardian_push`

Only these **edge functions** remain, each for a reason SQL cannot cover:

- `watch-pair`, `watch-ingest`: HTTP API for the Wear OS watch (headers
  `x-watch-id` + `x-device-token`). Their request/response shape is a contract with
  the watch app: do not change it casually.
- `generate-report`, `anomaly-detection` (calls an external AI service).
- `sos-realert`, `scheduled-safety-scan`: scheduled jobs (`x-cron-secret`).

## Devices and pairing

- **Watch:** a guardian links a Watch ID (`link_watch_to_my_child`), generates a
  6-digit code (`generate_watch_pairing_code`, hash stored in
  `smartwatch_devices.pairing_code_hash`), and the watch redeems it at `watch-pair`
  for a device token. One watch per child (`smartwatch_devices.child_id` is unique).
- **Child phone:** a guardian generates a code (`generate_child_phone_code`, stored in
  `child_mobile_devices`); the phone redeems the code alone with `pair_child_phone`
  and stores `{childId, deviceToken}` in AsyncStorage (`services/childMobileService.ts`).
  An invalid or revoked token raises SQLSTATE `28000`, and the app then returns to the
  link screen.
- **Watch codes and phone codes are different things.** A watch code cannot link a
  phone. The phone code comes from Edit Child Profile, "Generate Child Phone
  Connection Code" (tracking source Phone or Both).
- Codes: 6 digits, SHA-256 hex stored, valid for 10 minutes, single use; a new code
  replaces the previous one.

## Notifications

Guardian push notifications are sent **only by database triggers** through `pg_net`
to Expo's push API: `sos_alerts` insert and `realert_count` increase, and any
`geofence_events` insert. Never send pushes from app or edge-function code: insert
the row and the trigger does the rest. Tokens are in
`guardian_push_tokens.push_token`. Registration is skipped in Expo Go and when no
EAS project ID is configured.

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
- Postgres errors from `supabase-js` are plain objects, not `Error` instances: read
  `error.message`, never rely on `instanceof Error`.
- In React Native, `instanceof Response` fails; duck-type (`typeof x.json === "function"`).
- In `returns table (...)` plpgsql functions, output column names shadow table
  columns: always qualify columns with a table alias.

## Working in this repo

- **Environment:** `.env` holds `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (git-ignored). Without them `lib/supabase.ts`
  falls back to `placeholder.supabase.co`. `EXPO_PUBLIC_*` values are inlined at
  bundle time: restart with `npx expo start -c` after changing them.
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

## Known open issues

- Phone pairing codes are 6 digits and `pair_child_phone` is public: brute force
  within the 10-minute window is possible. Consider longer codes or attempt limits.
- The child-phone device token is stored unencrypted (AsyncStorage);
  `expo-secure-store` is not installed.
- Child phones only send location when the child taps "Send latest location";
  there is no background tracking.
- `anomaly_events` has an INSERT policy of `true` for `public`.
- The app calls `trigger_my_test_sos_alert` and `resolve_my_sos_alert`, which do not
  exist in the database.
- `admin_update_device_status` references a nonexistent `device_status` column, and
  `acknowledge_my_qr_assistance_alert` references a nonexistent table.
