# SafeTrack: Supabase backend reference

A complete description of SafeTrack's Supabase backend, for an agent (or person)
who has never seen this system. It covers what lives in the database, who may
touch what, how the apps and the watch talk to it, and the rules that have
broken things before.

- **Source:** the **live** database (project ref `evffpbkxnjpizwqsrlqx`), read on
  **2026-11-15** with `supabase gen types --linked` and read-only
  `supabase db query --linked` queries against `information_schema`, `pg_catalog`,
  `pg_policies`, `cron.job` and `storage.buckets`. It is not built from the
  migration files: the live schema differs from `supabase/migrations/`, because
  older tables were created outside them.
- **Companion file:** [AGENTS.md](AGENTS.md) explains the whole app (screens,
  maps, notifications, builds). If this file and the live database disagree,
  the live database wins: re-run the queries in "Checking the live database".
- **Secrets:** none are written here. Keys live in `.env` files, Supabase
  secrets and Vault. Never print them.

---

## 1. The system in one page

SafeTrack is a child-safety tracking system with three parts that share one
Supabase project:

| Part | Where | Talks to Supabase as |
|---|---|---|
| **Guardian / admin app** (Expo React Native + web) | `C:\SAFETRACK-FINAL\safe-track` | A signed-in user (`authenticated` role, Supabase Auth JWT) |
| **Child phone** (same Expo app in child mode) | same repo, `app/(child)` | `anon` (publishable key) + a **device token** checked inside each function |
| **Wear OS smartwatch** (Kotlin) | `C:\SAFETRACK-FINAL\safe-track-wear-os` | `anon` (publishable key) + **Watch ID + device token** checked inside each function |
| **Edge functions** (Deno) | `safe-track/supabase/functions/` | `service_role` |
| **AI service** (Python FastAPI on Render) | `safe-track/ai-service/` | `service_role` |

**The basic flow:**

1. A guardian signs up and gets a `persons` row with the role `GUARDIAN`.
2. The guardian registers a child, which creates a second `persons` row (no
   login) linked to the guardian by `person_relationships`.
3. The guardian pairs a watch and/or the child's phone with a 6-digit code. The
   device receives a long-lived device token; only its SHA-256 hash is stored.
4. The device sends locations, heartbeats and SOS alerts through
   **security-definer Postgres functions** (`record_watch_location_v2`,
   `trigger_watch_sos`, ...). Those functions write `location_logs`,
   `sos_alerts` and `geofence_events`, and check safe zones.
5. **Database triggers** send the guardian a push notification (Expo push
   API through `pg_net`) for every SOS and safety event.
6. The guardian app reads its own data directly with RLS-filtered `select`s and
   gets live updates from **Supabase Realtime**.
7. **Cron jobs** call edge functions every minute for SOS re-alerts and safety
   scans. The scan also asks the AI service to review new locations.

**Design rule:** server logic lives in **Postgres functions called with
`supabase.rpc()`**. Edge functions exist only where SQL cannot do the job (PDF
building, calling external HTTP services on a schedule). Clients never write
tables directly except a few guardian-owned tables (safe zones, push tokens,
notification preferences).

---

## 2. Identity and security model

### Who is who

- `persons` holds **every** human. For people who can sign in,
  `persons.id = persons.auth_user_id = auth.uid()` (enforced by the check
  `persons_login_id_matches_auth_user`). So `guardian_id = auth.uid()` is a
  valid ownership test everywhere.
- Children have `auth_user_id = null`. They never sign in; their devices
  authenticate with device tokens instead.
- Roles live **only** in `person_roles` → `roles` (`GUARDIAN`, `ADMIN`,
  `CHILD`). There is no `persons.role` column.
- `auth.users` (Supabase Auth) is outside the `public` schema; the link is
  `persons.auth_user_id`.

### Helper functions used by policies and RPCs

| Function | Returns true when |
|---|---|
| `current_person_id()` | returns the caller's `persons.id` (= `auth.uid()`) |
| `is_guardian_of(p_child_id)` | the caller has an active `person_relationships` row as guardian of that child |
| `is_safetrack_admin()` / `is_current_safetrack_admin()` | the caller has the active `ADMIN` role |
| `has_safetrack_role(code)`, `person_has_role(person, code)` | role checks |
| `can_access_person(id)` | the caller is that person, their guardian/child, or an admin |

### Row Level Security

- **RLS is ON for every public table.**
- **Clients can only read** almost everything. The direct-write exceptions are
  `geofences`, `guardian_push_tokens` and `guardian_notification_preferences`
  (own rows only), and admins on `menus`, `permissions`, `roles`, `person_roles`
  and `person_relationships`.
- Everything else is written by **security-definer functions** that check the
  caller themselves.
- **Trap:** an `update` or `insert` on a table without a matching policy affects
  0 rows and returns **no error**. If a write "does nothing", that is why. Add or
  use an RPC.
- Tables with RLS on and **no policies at all** (`child_mobile_devices`,
  `live_viewers`, the reserved AI tables, the backup table) are invisible to
  clients and are reached only through functions or the service role.

### Device authentication (watch and child phone)

- The device calls functions as `anon` and passes `p_device_token` (plus
  `p_watch_id` for the watch).
- Each function hashes the token, looks up the device row, and checks it is
  active and linked to a child (`watch_device()` / `child_phone_device()` do
  this).
- **Errors are machine-readable** (Postgres `HINT`): `watch_not_registered`,
  `watch_not_linked`, `no_active_code`, `code_expired`, `code_invalid`,
  `invalid_location`, `device_unlinked`.
- Only SQLSTATE **`28000`** (`device_unlinked`) means "this device was removed".
  The watch and phone then delete their token and go back to the pairing screen.
- **Pairing codes:** 6 digits, valid 10 minutes, single use; only the SHA-256
  hex is stored. A new code replaces the old one.

### Grants

- Supabase's default privileges grant **new functions to `anon`**.
- Every new function must `revoke all ... from public, anon` and then grant
  explicitly (`authenticated`, or `anon` only for device functions).
- Section 5 lists the live grants.

---

## 3. Relationships at a glance

All foreign keys point to a primary key `id`, except where noted. `persons` is the hub.

```
auth.users ──(auth_user_id)── persons ─┬─< person_roles >── roles ──< permissions >── menus
                                       ├─< person_relationships (guardian_person_id, child_person_id)
                                       ├─1 smartwatch_devices (child_id, UNIQUE: one watch per child)
                                       ├─< child_mobile_devices (child_id)
                                       ├─< location_logs (child_id) ─┬─< sos_alerts (location_log_id)
                                       │                             ├─< geofence_events (location_log_id)
                                       │                             └─< anomaly_events (location_log_id)
                                       ├─< geofences (child_id, guardian_id) ──< geofence_events (geofence_id)
                                       ├─< sos_alerts (child_id, guardian_id, acknowledged_by_person_id)
                                       ├─< geofence_events (child_id)
                                       ├─1 live_viewers (PK = child_id)
                                       ├─1 guardian_notification_preferences (PK = guardian_id)
                                       ├─< guardian_push_tokens (guardian_id)
                                       ├─< activity_reports (child_id, created_by_admin_id)
                                       └─< anomaly_events, child_behavior_profiles, ai_anomaly_records, ai_analysis_logs (child_id)
location_places: standalone cache, no foreign keys
```

- **Counts:** 22 base tables. 21 belong to the system; the 22nd,
  `geofence_events_removed_ai_notices`, is a backup copy.
- **Columns:** 217 across the 21 system tables.
- **Foreign keys:** 29.
- **View:** `children` (see section 4).
- **Diagram:** the ERD (Figure 88) is in
  `C:\SAFETRACK-FINAL\Manuscript-Updates\Database-Design\` (PNG, SVG, editable
  `.drawio`), with `ERD-Verification.txt`.

---

## 4. Tables (live)

Each table lists its columns in database order, with the SQL type, the default
and the keys, then its unique and check constraints and its RLS policies.

### View: `children`

- **What it is:** the read model for a guardian's children. Columns:
  `id, guardian_id, full_name, age, relationship, tracking_source, avatar_path,
  created_at, updated_at`. It shows active children only.
- **Security:** `security_invoker`, so RLS applies.
- **Read-only:** write through `register_my_child`, `update_my_child_profile`
  and `delete_my_child`.
- **Trap:** PostgREST's type generation repeats every `persons` foreign key for
  this view. Those duplicates are not real foreign keys.

### `activity_reports`

Admin-generated PDF/Excel reports; the files live in the private `activity-reports` storage bucket.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `created_by_admin_id` | uuid |  | FK → `persons.id` |
| `report_title` | text not null |  |  |
| `report_type` | text not null |  |  |
| `child_id` | uuid |  | FK → `persons.id` |
| `date_from` | date not null |  |  |
| `date_to` | date not null |  |  |
| `export_format` | text not null |  |  |
| `report_status` | text not null | 'requested'::text |  |
| `filters` | jsonb not null | '{}'::jsonb |  |
| `record_count` | int4 not null | 0 |  |
| `file_path` | text |  |  |
| `generated_at` | timestamptz |  |  |
| `created_at` | timestamptz not null | now() |  |
| `updated_at` | timestamptz not null | now() |  |

**Checks:** `((date_to >= date_from))`; `((lower(export_format) = ANY (ARRAY['pdf', 'excel', 'xlsx'])))`; `((record_count >= 0))`; `((lower(report_status) = ANY (ARRAY['pending', 'generating', 'processing', 'completed', 'failed'])))`; `(((char_length(TRIM(BOTH FROM report_title)) >= 1) AND (char_length(TRIM(BOTH FROM report_title)) <= 200)))`; `((lower(report_type) = ANY (ARRAY['child_activity', 'system_activity', 'activity', 'summary', 'sos', 'location', 'safety', 'safe_zone', 'custom'])))`

**RLS policies:** SELECT: ( SELECT private.is_system_administrator() AS is_system_administrator); SELECT: is_safetrack_admin()

### `ai_analysis_logs`

**Reserved.** Exists in the database; nothing uses it.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | uuid_generate_v4() | PK |
| `model_name` | text |  |  |
| `records_processed` | int4 |  |  |
| `anomalies_detected` | int4 |  |  |
| `processing_time` | numeric |  |  |
| `analyzed_at` | timestamp | now() |  |
| `child_id` | uuid | gen_random_uuid() | FK → `persons.id` |

**RLS policies:** none (RLS is on, so clients get nothing; only security-definer functions and the service role reach it)

### `ai_anomaly_records`

**Reserved.** Exists in the database; nothing uses it.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | uuid_generate_v4() | PK |
| `child_id` | uuid |  | FK → `persons.id` |
| `detection_type` | text |  |  |
| `anomaly_score` | numeric |  |  |
| `severity` | text |  |  |
| `reason` | text |  |  |
| `latitude` | numeric |  |  |
| `longitude` | numeric |  |  |
| `status` | text | 'Pending'::text |  |
| `detected_at` | timestamp | now() |  |

**RLS policies:** none (RLS is on, so clients get nothing; only security-definer functions and the service role reach it)

### `anomaly_events`

Written and read by the Python AI service (`ai-service/app.py`, `detect_anomaly.py`) through its `/detect` and `/anomalies` endpoints. The guardian app's AI notices come from `geofence_events` (`possible_anomaly`), not from here.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `child_id` | uuid not null |  | FK → `persons.id` |
| `location_log_id` | uuid |  | FK → `location_logs.id` |
| `detection_type` | text not null |  |  |
| `severity` | text | 'medium'::text |  |
| `anomaly_score` | numeric |  |  |
| `reason` | text |  |  |
| `details` | jsonb | '{}'::jsonb |  |
| `status` | text | 'active'::text |  |
| `detected_at` | timestamptz | now() |  |

**RLS policies:** SELECT: is_current_safetrack_admin(); SELECT: is_guardian_of(child_id)

### `child_behavior_profiles`

**Reserved.** Exists in the database; nothing in the app, watch or AI service uses it.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `child_id` | uuid not null |  | FK → `persons.id` |
| `baseline_start` | date |  |  |
| `baseline_end` | date |  |  |
| `average_speed` | numeric | 0 |  |
| `average_distance` | numeric | 0 |  |
| `usual_locations` | jsonb | '{}'::jsonb |  |
| `usual_routes` | jsonb | '{}'::jsonb |  |
| `training_samples` | int4 | 0 |  |
| `model_status` | text | 'learning'::text |  |
| `created_at` | timestamptz | now() |  |
| `updated_at` | timestamptz | now() |  |

**RLS policies:** SELECT: is_current_safetrack_admin(); SELECT: is_guardian_of(child_id)

### `child_mobile_devices`

A child's phone running the app in child mode. Same pairing-code/device-token-hash idea as the watch. No client policies: reached only through `pair_child_phone` and the other `*_child_phone_*` functions.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `child_id` | uuid not null |  | FK → `persons.id` |
| `device_token_hash` | text |  |  |
| `pairing_code_hash` | text |  |  |
| `pairing_code_expires_at` | timestamptz |  |  |
| `pairing_code_created_at` | timestamptz |  |  |
| `platform` | text |  |  |
| `device_model` | text |  |  |
| `is_active` | bool | true |  |
| `paired_at` | timestamptz |  |  |
| `last_seen_at` | timestamptz |  |  |
| `created_at` | timestamptz | now() |  |
| `updated_at` | timestamptz | now() |  |

**RLS policies:** none (RLS is on, so clients get nothing; only security-definer functions and the service role reach it)

### `geofence_events`

All safety notices, not only zone events: `entry`, `exit`, `possible_anomaly` (AI), `watch_disconnected`, `prolonged_inactivity`. In the realtime publication. An insert fires the guardian push trigger.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `child_id` | uuid |  | FK → `persons.id` |
| `geofence_id` | uuid |  | FK → `geofences.id` |
| `location_log_id` | uuid |  | FK → `location_logs.id` |
| `event_type` | text not null |  |  |
| `title` | text not null |  |  |
| `details` | text |  |  |
| `anomaly_score` | numeric |  |  |
| `latitude` | numeric |  |  |
| `longitude` | numeric |  |  |
| `occurred_at` | timestamptz not null | now() |  |
| `created_at` | timestamptz not null | now() |  |

**Checks:** `(((anomaly_score IS NULL) OR ((anomaly_score >= (0)) AND (anomaly_score <= (1)))))`; `((event_type = ANY (ARRAY['entry', 'exit', 'possible_anomaly', 'watch_disconnected', 'prolonged_inactivity'])))`; `(((latitude IS NULL) OR ((latitude >= ('-90'::integer)) AND (latitude <= (90)))))`; `(((longitude IS NULL) OR ((longitude >= ('-180'::integer)) AND (longitude <= (180)))))`

**RLS policies:** SELECT: is_guardian_of(child_id); SELECT: is_safetrack_admin()

### `geofence_events_removed_ai_notices`

Backup copy of AI notices removed by migration 20261102. Nothing reads or writes it. Not part of the system; kept only as a backup.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `child_id` | uuid |  |  |
| `geofence_id` | uuid |  |  |
| `location_log_id` | uuid |  |  |
| `event_type` | text not null |  |  |
| `title` | text not null |  |  |
| `details` | text |  |  |
| `anomaly_score` | numeric |  |  |
| `latitude` | numeric |  |  |
| `longitude` | numeric |  |  |
| `occurred_at` | timestamptz not null | now() |  |
| `created_at` | timestamptz not null | now() |  |

**Checks:** `(((anomaly_score IS NULL) OR ((anomaly_score >= (0)) AND (anomaly_score <= (1)))))`; `((event_type = ANY (ARRAY['entry', 'exit', 'possible_anomaly', 'watch_disconnected', 'prolonged_inactivity'])))`; `(((latitude IS NULL) OR ((latitude >= ('-90'::integer)) AND (latitude <= (90)))))`; `(((longitude IS NULL) OR ((longitude >= ('-180'::integer)) AND (longitude <= (180)))))`

**RLS policies:** none (RLS is on, so clients get nothing; only security-definer functions and the service role reach it)

### `geofences`

Safe zones a guardian draws for a child (circle, 30–5000 m).

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `guardian_id` | uuid |  | FK → `persons.id` |
| `child_id` | uuid |  | FK → `persons.id` |
| `name` | text not null |  |  |
| `address` | text |  |  |
| `latitude` | numeric not null |  |  |
| `longitude` | numeric not null |  |  |
| `radius_meters` | int4 not null |  |  |
| `is_enabled` | bool not null | true |  |
| `created_at` | timestamptz not null | now() |  |
| `updated_at` | timestamptz not null | now() |  |

**Checks:** `(((latitude >= ('-90'::integer)) AND (latitude <= (90))))`; `(((longitude >= ('-180'::integer)) AND (longitude <= (180))))`; `(((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 100)))`; `(((radius_meters >= 30) AND (radius_meters <= 5000)))`

**RLS policies:** INSERT: CHECK ((guardian_id = auth.uid()) AND is_guardian_of(child_id)); DELETE: (guardian_id = auth.uid()); UPDATE: (guardian_id = auth.uid()) CHECK ((guardian_id = auth.uid()) AND is_guardian_of(child_id)); SELECT: (guardian_id = auth.uid()); SELECT: is_safetrack_admin()

### `guardian_notification_preferences`

Per-guardian on/off for push categories `safe_zone`, `anomaly`, `device`. SOS is always sent regardless.

| Column | Type | Default | Key |
|---|---|---|---|
| `guardian_id` | uuid not null |  | PK, FK → `persons.id` |
| `safe_zone` | bool not null | true |  |
| `anomaly` | bool not null | true |  |
| `device` | bool not null | true |  |
| `updated_at` | timestamptz not null | now() |  |

**RLS policies:** INSERT: CHECK ((guardian_id = auth.uid()) AND person_has_role(auth.uid(), 'GUARDIAN'::text)); UPDATE: (guardian_id = auth.uid()) CHECK (guardian_id = auth.uid()); SELECT: (guardian_id = auth.uid())

### `guardian_push_tokens`

Expo push tokens of guardian devices (`ExponentPushToken[...]`).

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `guardian_id` | uuid |  | FK → `persons.id` |
| `push_token` | text not null |  |  |
| `platform` | text not null |  |  |
| `device_name` | text |  |  |
| `is_active` | bool not null | true |  |
| `last_seen_at` | timestamptz not null | now() |  |
| `created_at` | timestamptz not null | now() |  |
| `updated_at` | timestamptz not null | now() |  |

**Unique:** (push_token)

**Checks:** `((platform = ANY (ARRAY['android', 'ios', 'web'])))`

**RLS policies:** INSERT: CHECK (guardian_id = auth.uid()); DELETE: (guardian_id = auth.uid()); UPDATE: (guardian_id = auth.uid()) CHECK (guardian_id = auth.uid()); SELECT: (guardian_id = auth.uid())

### `live_viewers`

Who is watching a child's live map right now: `until` is pushed 30 s ahead by `request_child_live` every 15 s. The watch/phone `push_*_live` functions read it to decide whether to stream. No client policies.

| Column | Type | Default | Key |
|---|---|---|---|
| `child_id` | uuid not null |  | PK, FK → `persons.id` |
| `until` | timestamptz not null |  |  |
| `requested_by` | uuid |  |  |
| `updated_at` | timestamptz not null | now() |  |

**RLS policies:** none (RLS is on, so clients get nothing; only security-definer functions and the service role reach it)

### `location_logs`

Every saved location point (watch or phone). In the `supabase_realtime` publication. `travel_mode` still accepts the old `biking` value, which the app reads as `vehicle`.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `child_id` | uuid |  | FK → `persons.id` |
| `source` | text not null |  |  |
| `latitude` | numeric not null |  |  |
| `longitude` | numeric not null |  |  |
| `accuracy_meters` | numeric |  |  |
| `location_label` | text |  |  |
| `recorded_at` | timestamptz not null | now() |  |
| `created_at` | timestamptz not null | now() |  |
| `speed_mps` | float4 |  |  |
| `heading_degrees` | float4 |  |  |
| `travel_mode` | text |  |  |
| `mode_confidence` | float4 |  |  |

**Checks:** `(((accuracy_meters IS NULL) OR (accuracy_meters >= (0))))`; `(((latitude >= ('-90'::integer)) AND (latitude <= (90))))`; `(((longitude >= ('-180'::integer)) AND (longitude <= (180))))`; `(((mode_confidence IS NULL) OR ((mode_confidence >= (0)::double precision) AND (mode_confidence <= (1)::double precision))))`; `((source = ANY (ARRAY['smartwatch', 'mobile'])))`; `(((travel_mode IS NULL) OR (travel_mode = ANY (ARRAY['still', 'walking', 'running', 'biking', 'vehicle', 'boat', 'unknown']))))`

**RLS policies:** SELECT: is_guardian_of(child_id); SELECT: is_safetrack_admin()

### `location_places`

Shared cache of reverse-geocoded place names per ~55 m cell (`cell` = `location_cell(lat, lon)`), written only through `save_location_place`. Only OpenStreetMap results are stored (Mapbox results must not be). No foreign keys.

| Column | Type | Default | Key |
|---|---|---|---|
| `cell` | text not null |  | PK |
| `latitude` | float8 not null |  |  |
| `longitude` | float8 not null |  |  |
| `label` | text not null |  |  |
| `details` | jsonb not null | '{}'::jsonb |  |
| `provider` | text not null | 'osm'::text |  |
| `fetched_at` | timestamptz not null | now() |  |

**RLS policies:** SELECT: true

### `menus`

Admin-module navigation entries (route paths). Read by `services/menuPermissionsService.ts`.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `menu_key` | text not null |  |  |
| `menu_name` | text not null |  |  |
| `route_path` | text not null |  |  |
| `icon_name` | text |  |  |
| `display_order` | int4 not null | 0 |  |
| `is_active` | bool not null | true |  |
| `created_at` | timestamptz not null | now() |  |
| `updated_at` | timestamptz not null | now() |  |

**Unique:** (menu_key); (route_path)

**RLS policies:** ALL: has_safetrack_role('ADMIN'::text) CHECK has_safetrack_role('ADMIN'::text); SELECT: true

### `permissions`

Per role × menu rights (`can_view`, `can_create`, ...). Read by `services/menuPermissionsService.ts`.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `role_id` | uuid not null |  | FK → `roles.id` |
| `menu_id` | uuid not null |  | FK → `menus.id` |
| `can_view` | bool not null | false |  |
| `can_create` | bool not null | false |  |
| `can_edit` | bool not null | false |  |
| `can_delete` | bool not null | false |  |
| `can_export` | bool not null | false |  |
| `can_acknowledge` | bool not null | false |  |
| `created_at` | timestamptz not null | now() |  |
| `updated_at` | timestamptz not null | now() |  |

**Unique:** (role_id, menu_id)

**RLS policies:** ALL: has_safetrack_role('ADMIN'::text) CHECK has_safetrack_role('ADMIN'::text); SELECT: true

### `person_relationships`

Guardian ↔ child link. A child has at most one active primary guardian (unique partial index). `is_guardian_of(child_id)` is built on this table.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `guardian_person_id` | uuid not null |  | FK → `persons.id` |
| `child_person_id` | uuid not null |  | FK → `persons.id` |
| `relationship_type` | text not null | 'Child'::text |  |
| `is_primary` | bool not null | false |  |
| `created_at` | timestamptz not null | now() |  |
| `updated_at` | timestamptz not null | now() |  |
| `is_active` | bool not null | true |  |

**Unique:** (guardian_person_id, child_person_id)

**Checks:** `((guardian_person_id <> child_person_id))`

**RLS policies:** ALL: has_safetrack_role('ADMIN'::text) CHECK has_safetrack_role('ADMIN'::text); SELECT: ((guardian_person_id = current_person_id()) OR (child_person_id = current_person_id()) OR has_safetrack_role('ADMIN'::text))

### `person_roles`

Which role(s) a person has. The only place roles live (there is no `persons.role`).

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `person_id` | uuid not null |  | FK → `persons.id` |
| `role_id` | uuid not null |  | FK → `roles.id` |
| `is_primary` | bool not null | true |  |
| `is_active` | bool not null | true |  |
| `assigned_by_person_id` | uuid |  | FK → `persons.id` |
| `assigned_at` | timestamptz not null | now() |  |

**Unique:** (person_id, role_id)

**RLS policies:** ALL: has_safetrack_role('ADMIN'::text) CHECK has_safetrack_role('ADMIN'::text); SELECT: ((person_id = current_person_id()) OR has_safetrack_role('ADMIN'::text))

### `persons`

Every human: guardian, admin and child. For anyone who can sign in, `id = auth_user_id = auth.uid()` (check constraint). Children have `auth_user_id = null` and use `age` and `tracking_source` (`smartwatch | mobile | both`). Soft-deleted with `is_active = false`; never hard-delete.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `auth_user_id` | uuid |  |  |
| `full_name` | text not null |  |  |
| `email` | text |  |  |
| `phone_number` | text |  |  |
| `avatar_path` | text |  |  |
| `age` | int2 |  |  |
| `tracking_source` | text |  |  |
| `is_active` | bool not null | true |  |
| `created_at` | timestamptz not null | now() |  |
| `updated_at` | timestamptz not null | now() |  |

**Unique:** (auth_user_id)

**Checks:** `(((age IS NULL) OR ((age >= 0) AND (age <= 120))))`; `(((auth_user_id IS NULL) OR (auth_user_id = id)))`; `(((tracking_source IS NULL) OR (tracking_source = ANY (ARRAY['smartwatch', 'mobile', 'both']))))`

**RLS policies:** SELECT: can_access_person(id)

### `roles`

Role catalogue. Codes used by the system: `GUARDIAN`, `ADMIN`, `CHILD`.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `role_code` | text not null |  |  |
| `role_name` | text not null |  |  |
| `description` | text |  |  |
| `is_active` | bool not null | true |  |
| `created_at` | timestamptz not null | now() |  |
| `updated_at` | timestamptz not null | now() |  |

**Unique:** (role_code); (role_name)

**RLS policies:** ALL: has_safetrack_role('ADMIN'::text) CHECK has_safetrack_role('ADMIN'::text); SELECT: true

### `smartwatch_devices`

One Wear OS watch. `watch_id` looks like `ST-WATCH-XXXXXXXX`. At most one watch per child (`child_id` unique). Pairing code and device token are stored only as SHA-256 hashes. Holds the watch's latest battery, network and model (there is no battery history).

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `watch_id` | text not null |  |  |
| `child_id` | uuid |  | FK → `persons.id` |
| `is_active` | bool not null | true |  |
| `paired_at` | timestamptz |  |  |
| `last_verified_at` | timestamptz |  |  |
| `created_at` | timestamptz not null | now() |  |
| `updated_at` | timestamptz not null | now() |  |
| `last_seen_at` | timestamptz |  |  |
| `device_token_hash` | text |  |  |
| `pairing_code_hash` | text |  |  |
| `pairing_code_expires_at` | timestamptz |  |  |
| `pairing_code_created_at` | timestamptz |  |  |
| `last_battery_percent` | int4 |  |  |
| `last_network_type` | text |  |  |
| `device_model` | text |  |  |
| `last_location_at` | timestamptz |  |  |
| `last_ai_review_at` | timestamptz |  |  |

**Unique:** (child_id); (watch_id)

**Checks:** `(((last_battery_percent IS NULL) OR ((last_battery_percent >= 0) AND (last_battery_percent <= 100))))`; `((watch_id ~ '^[A-Z0-9-]{4,64}$'))`

**RLS policies:** SELECT: is_guardian_of(child_id); SELECT: is_safetrack_admin()

### `sos_alerts`

SOS alerts from the watch or phone. `status`: `active | acknowledged | cancelled`. Re-alerts raise `realert_count`. In the realtime publication. Insert and re-alert fire the guardian push trigger.

| Column | Type | Default | Key |
|---|---|---|---|
| `id` | uuid not null | gen_random_uuid() | PK |
| `child_id` | uuid |  | FK → `persons.id` |
| `guardian_id` | uuid |  | FK → `persons.id` |
| `location_log_id` | uuid |  | FK → `location_logs.id` |
| `activation_method` | text not null |  |  |
| `status` | text not null | 'active'::text |  |
| `location_source` | text |  |  |
| `latitude` | numeric |  |  |
| `longitude` | numeric |  |  |
| `accuracy_meters` | numeric |  |  |
| `triggered_at` | timestamptz not null | now() |  |
| `acknowledged_at` | timestamptz |  |  |
| `last_realert_at` | timestamptz |  |  |
| `realert_count` | int4 not null | 0 |  |
| `is_test` | bool not null | false |  |
| `created_at` | timestamptz not null | now() |  |
| `updated_at` | timestamptz not null | now() |  |
| `acknowledged_by_person_id` | uuid |  | FK → `persons.id` |

**Checks:** `(((accuracy_meters IS NULL) OR (accuracy_meters >= (0))))`; `((activation_method = ANY (ARRAY['tap_and_hold', 'tap_hold', 'manual_button', 'shake'])))`; `(((latitude IS NULL) OR ((latitude >= ('-90'::integer)) AND (latitude <= (90)))))`; `(((location_source IS NULL) OR (location_source = ANY (ARRAY['smartwatch', 'mobile']))))`; `(((longitude IS NULL) OR ((longitude >= ('-180'::integer)) AND (longitude <= (180)))))`; `((realert_count >= 0))`; `((status = ANY (ARRAY['active', 'acknowledged', 'cancelled'])))`

**RLS policies:** SELECT: (guardian_id = auth.uid()); SELECT: is_safetrack_admin()

---

## 5. Database functions (RPCs)

All are in `public` and called with `supabase.rpc(name, { p_...: value })`.
**Parameter names are part of the contract:** the deployed watch sends named
`p_*` parameters, so renaming one breaks every watch already in use. Add an
optional parameter or a `_v2` wrapper instead.

**Grant** = who may call it, live (`auth` = authenticated, `svc` = service_role
only). **All are `security definer`** unless marked *(invoker)*.

### Guardian (signed-in app)

| Function | Args | What it does |
|---|---|---|
| `ensure_guardian_profile` | p_full_name, p_email | Creates/returns the caller's `persons` row + `GUARDIAN` role after sign-up/sign-in. Refuses inactive (deleted) accounts. |
| `create_my_guardian_person` | p_full_name, p_email?, p_avatar_path? | Older profile creator (still granted). |
| `update_my_person_profile` | p_full_name, p_email?, p_phone_number?, p_avatar_path? | Edits own profile. |
| `register_my_child` | p_full_name, p_age, p_relationship, p_tracking_source, p_watch_id? | Creates the child `persons` row, `CHILD` role and relationship; optionally links a watch. Returns JSON. |
| `update_my_child_profile` | p_child_id, p_full_name, p_age, p_relationship, p_tracking_source, p_avatar_path? | Edits a child (checks `is_guardian_of`). |
| `delete_my_child` | p_child_id | **Soft** delete (`is_active=false`) so history keeps its owner. |
| `delete_my_account` | – | Soft-deletes the guardian: removes children (unless another guardian is linked), disables zones, tokens, roles; blanks personal data; bans the auth user until 2999-12-31. |
| `link_watch_to_my_child` | p_child_id, p_watch_id | Links a Watch ID (creates the `smartwatch_devices` row for an unknown well-formed ID via `find_or_register_watch`). Releases any previous watch. |
| `unlink_watch_from_my_child` | p_child_id | Releases the watch and clears its device token. |
| `verify_watch_id` | p_watch_id | Checks a Watch ID before linking. |
| `generate_watch_pairing_code` | p_child_id | New 6-digit code for the watch (hash stored). |
| `generate_child_phone_code` | p_child_id | New 6-digit code for the child phone. |
| `register_my_push_token` | p_push_token, p_platform, p_device_name? | Upserts the guardian's Expo push token. Token must match `^Expo(nent)?PushToken\[[^\]]+\]$`. |
| `get_my_child_safety_timeline` | p_child_id, p_start_at?, p_end_at? | SOS + safety events for History/Safety screens. |
| `get_my_child_activity_days` | p_child_id, p_from, p_to | Per-day counts (locations, events, SOS) for the History calendar, max 63 days. |
| `acknowledge_my_sos_alert` | p_alert_id | Guardian acknowledges an active SOS. |
| `request_child_live` | p_child_id, p_seconds? | Marks the guardian as watching the live map (`live_viewers.until = now + 30 s`). Called every 15 s while the map is open. |

### Child phone (`anon` + device token)

| Function | What it does |
|---|---|
| `pair_child_phone(p_code, p_platform?, p_device_model?)` | Redeems the code alone; returns `{childId, deviceToken}` (the phone stores it in AsyncStorage). |
| `get_child_phone_state(p_child_id, p_device_token)` | The child dashboard's data. |
| `record_child_phone_location` / `record_child_phone_location_v2` | Saves a point (v2 adds speed, heading, travel mode, confidence). Runs safe-zone processing. |
| `push_child_phone_live(...)` | Live point while a guardian watches: **broadcast only, not saved**. Returns `live: true/false`. |
| `trigger_child_phone_sos`, `realert_child_phone_sos` | SOS from the phone, and a manual re-alert. |
| `unlink_child_phone` | The phone unlinks itself. |

### Smartwatch (`anon` + Watch ID + device token)

All take optional `p_battery_percent`, `p_network_type`
(`Wi-Fi | LTE | No network | Unknown`) and `p_device_model`, which are stored
on `smartwatch_devices`.

| Function | What it does |
|---|---|
| `pair_watch(p_watch_id, p_connection_code, p_device_model?)` | Redeems the guardian's code; returns the device token. |
| `record_watch_heartbeat(...)` | "I'm alive" + battery/network. Returns `safeZone` status. |
| `record_watch_location(...)` / `record_watch_location_v2(...)` | Saves a point (v2 adds speed, heading, travel mode, confidence; v2 wraps the original so old watches still work). Advances `last_location_at` (never backwards). Runs `process_safe_zone_events`. Returns `safeZone`. |
| `trigger_watch_sos(..., p_activation_method, p_triggered_at, p_latitude?, ...)` | Creates an SOS. A resend with the same `p_triggered_at` returns the existing alert (`duplicate: true`): the watch retries until it gets an answer. |
| `cancel_watch_sos(..., p_sos_alert_id)` | Child's "Sent by mistake": cancels that child's active SOS and pushes the guardian (`sos_cancelled`). |
| `push_watch_live(...)` | Live point while watched: broadcast on `child-live:<childId>`, **not saved**. Also stores battery/network when changed, and returns `childName` (so the watch shows a renamed child). |

### Admin (signed-in admin)

`get_admin_summary_metrics`, `get_admin_guardian_accounts(p_search?)`,
`get_admin_guardian_detail(p_guardian_id)`,
`update_admin_guardian_account_status(p_guardian_id, p_status)`,
`get_admin_smartwatch_devices(p_search?)`,
`get_admin_smartwatch_device_detail(p_device_id)`,
`update_admin_smartwatch_device_status(p_device_id, p_status)`,
`admin_update_device_status` (legacy; delegates to the previous one),
`get_admin_report_summary(p_start, p_end)`, `admin_report_rows(p_from, p_to)`,
`complete_activity_report(p_report_id, p_file_path?, p_record_count?)`.
Each checks the admin role inside.

### Internal (service role / called by other functions)

| Function | Role |
|---|---|
| `create_child_person`, `find_or_register_watch` | Used by `register_my_child` / linking. |
| `watch_device`, `child_phone_device` | Validate a device token, return the device row. |
| `touch_watch` | Updates last seen / battery / network / model. |
| `insert_watch_location` | Inserts a `location_logs` row for a watch. |
| `process_safe_zone_events(p_child_id, p_location_log_id)` | Compares the point with the child's enabled `geofences` and inserts `entry`/`exit` rows into `geofence_events`. |
| `safe_zone_status(p_child_id)` | Current inside/outside per zone (returned to devices). |
| `broadcast_child_live(...)` | Sends the live payload with `realtime.send` to `child-live:<childId>`. |
| `send_guardian_push(p_guardian_id, p_title, p_body, p_data)` | Posts to Expo's push API through `pg_net`; picks the Android channel; honours notification preferences (SOS always sent). |
| `notify_guardian_of_sos`, `notify_guardian_of_safety_event` | Trigger functions (section 6). |
| `validate_alert_guardian_child_link` *(invoker)* | Trigger: an SOS's guardian must really be that child's guardian. |
| `safetrack_ai_baseline(p_child_id, p_before, ...)` | History sample for the AI review (thinned, accuracy-filtered). |
| `location_cell(lat, lon)` *(invoker)* | The ~55 m cell key: `floor(lat*2000):floor(lon*2000)`. |
| `save_location_place(p_latitude, p_longitude, p_label, p_details?)` | Upserts a place name into `location_places` for that cell. |
| `distance_meters`, `clean_travel_mode`, `location_log_json`, `sos_alert_json`, `set_updated_at`, `admin_set_updated_at` *(invoker)* | Helpers. |

### Live grant snapshot (worth knowing)

- **Service role only:** `broadcast_child_live`, `child_phone_device`,
  `create_child_person`, `find_or_register_watch`, `insert_watch_location`,
  `notify_guardian_of_sos`, `process_safe_zone_events`, `safe_zone_status`,
  `send_guardian_push`, `touch_watch` and `watch_device`.
- **`authenticated` only (not `anon`):** all `*_my_*` guardian functions,
  `is_guardian_of`, `is_safetrack_admin`, `person_has_role`, `request_child_live`
  and `verify_watch_id`.
- **Also granted to `anon`:** the device functions, which is intended. The
  `get_admin_*` and `update_admin_*` functions, `complete_activity_report`,
  `safetrack_ai_baseline`, `update_my_person_profile`,
  `create_my_guardian_person` and `save_location_place` are also granted to
  `anon`. They check the caller inside, but tightening these grants is a
  sensible clean-up (see section 11).

---

## 6. Triggers (live)

| Table | Trigger | When | Does |
|---|---|---|---|
| `sos_alerts` | `validate_sos_alert_guardian_child` | before insert/update | Rejects an alert whose guardian is not linked to the child |
| `sos_alerts` | `sos_alerts_notify_guardian` | after insert/update | Push "SOS from <child>"; on `realert_count` increase while active: "SOS re-alert #N" |
| `geofence_events` | `geofence_events_notify_guardian` | after insert | Push for entry/exit/AI/device notices (respects preferences) |
| `activity_reports`, `geofences`, `guardian_push_tokens`, `sos_alerts`, `smartwatch_devices` | `set_*_updated_at` / `smartwatch_devices_updated_at` / `trg_admin_smartwatch_devices_updated_at` | before update | Sets `updated_at` |

**Rule:** pushes are sent **only by these triggers**. App and edge-function code
must insert the row and let the trigger notify. Never call Expo directly.

**Android channels chosen by `send_guardian_push`:**

| Type | Channel |
|---|---|
| `sos`, `sos_realert` | `safetrack-sos-v2` |
| `entry`, `exit` | `safetrack-zones` |
| anything else | `safetrack-alerts` |

---

## 7. Realtime

**Postgres changes:** the `supabase_realtime` publication contains these tables
(RLS still applies to what each subscriber receives):

| Table | What it is used for |
|---|---|
| `location_logs` | New points on the guardian map |
| `sos_alerts` | `useGuardianSosRealtime`, the SOS banner |
| `geofence_events` | Live notices and local notifications |
| `persons`, `person_relationships` | Admin live updates |

**Broadcast channels:**

| Topic | Private? | Who sends | Who listens | Payload |
|---|---|---|---|---|
| `child-live:<child uuid>` | **Private.** The `realtime.messages` policy allows only `is_guardian_of(child)` | `broadcast_child_live` (from `push_watch_live` / `push_child_phone_live`) | Guardian app (`services/liveLocationService.ts`) | Live fix: lat/lon, accuracy, speed, heading, travel mode, battery, network. About 1 per second; **never saved** |
| `live-wake:<child uuid>` | Public, no data | Guardian app right after `request_child_live` (repeated every 3 s, up to 4 times) | Watch (`LiveWake.kt`) and phone (`childBackgroundLocation.ts`) | Empty "wake up". The device then calls `push_*_live` at once; the database decides whether anyone is really watching |

**How live tracking works:**

1. While Home or Location is open, the guardian app calls `request_child_live`
   every 15 s.
2. The device calls `push_*_live` at least every 20 s, or right away on a wake.
3. While the answer is `live: true`, the device sends a fix every 1 s (every 5 s
   when still).
4. When the guardian leaves the screen, `until` expires and the device goes back
   to normal saving: a point every 10 s / 15 m when moving, one every 3 min when
   still.

---

## 8. Storage

| Bucket | Public? | Contents | Access |
|---|---|---|---|
| `profile-avatars` | private | `guardian/<auth uid>/…` and `child/<child id>/…` photos | Policy "SafeTrack profile avatar access": own guardian folder, or the folder of a child you guard. The app shows them through signed URLs (`useAvatarUrl`, cached ~50 min) |
| `activity-reports` | private | Admin PDF/Excel exports | Written by the `generate-report` edge function (service role); returned as 1-hour signed URLs |

---

## 9. Scheduled jobs, edge functions, AI service

### Cron jobs (`cron.job`, live)

| Job | Schedule | Does |
|---|---|---|
| `safetrack-sos-realert` | every minute | `net.http_post` to the `sos-realert` edge function with `x-cron-secret`. The URL and secret come from **Vault** (`safetrack_project_url`, ...) |
| `safetrack-safety-scan` | every minute | `net.http_post` to `scheduled-safety-scan` (same pattern) |
| `safetrack-ai-keep-awake` | every 10 min | `net.http_get` to `https://safetrack-ai-qigk.onrender.com/` so the free Render service doesn't sleep |

**Extensions:** `pg_cron`, `pg_net`, `pgcrypto` (hashing),
`supabase_vault`, `uuid-ossp`, `pg_stat_statements`.

### Edge functions (`supabase/functions/`, Deno)

| Function | Auth | Purpose |
|---|---|---|
| `generate-report` | admin JWT (`verify_jwt = true`) | Builds PDF (pdf-lib) / Excel (SheetJS), uploads to `activity-reports`, records `activity_reports`, returns a signed URL. Pages rows 1000 at a time, up to 5000 per type. |
| `sos-realert` | `x-cron-secret` | For each `active` SOS older than `SOS_REALERT_SECONDS` (default 120) since the last alert, and below `SOS_MAX_REALERTS` (default 10): increments `realert_count`. The trigger sends the push. |
| `scheduled-safety-scan` | `x-cron-secret` | Creates `watch_disconnected` (no contact for `WATCH_DISCONNECT_SECONDS`, default 300) and `prolonged_inactivity` (`PROLONGED_INACTIVITY_SECONDS`, default 1800) notices **once per episode**, with reminders at most every `RULE_ALERT_REMINDER_SECONDS` (12 h). Runs the AI review of each watch's newest point (tracked by `smartwatch_devices.last_ai_review_at`). |
| `anomaly-detection` | `x-cron-secret` | On-demand AI review of one `{childId, locationLogId}`. The app does not call it. |
| `watch-pair`, `watch-ingest` | none (legacy) | **Unused.** Replaced by the watch database functions; safe to delete once no old watch build uses them. |

**Secrets** (names only): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`CRON_SECRET`, `AI_ENABLED`, `AI_SERVICE_URL`, `AI_SERVICE_KEY`,
`AI_MIN_HISTORY_POINTS`, `AI_MIN_BASELINE_DAYS`, plus the timing variables
above.

**Shared code** in `_shared/`:

| File | Contains |
|---|---|
| `anomaly.ts` | The AI call and history thinning |
| `device-auth.ts`, `crypto.ts` | Token hashing and `safeEqual` |
| `geofence.ts` | Safe-zone geometry |
| `identity.ts` | Matching a caller to `persons` |
| `response.ts` | JSON responses and CORS |
| `supabase.ts` | The service client |

### AI service (`ai-service/`, FastAPI on Render)

- **What it does:** `POST /score` checks a location with an Isolation Forest
  model.
- **When it is called:** only from `_shared/anomaly.ts`, with header
  `X-SafeTrack-AI-Key`, and only when `AI_ENABLED=true`.
- **When it is skipped:**
  - the child has fewer than 100 earlier points or less than 14 days of history;
  - the point is inside an enabled safe zone;
  - a notice was already sent in the last 15 minutes.
- **Result:** a `possible_anomaly` row in `geofence_events`; the trigger then
  pushes the guardian.
- **Its own endpoints:** `/detect` and `/anomalies/{child_id}` read and write
  `anomaly_events`.

---

## 10. End-to-end data flows

**Watch location saved**
1. The watch calls `record_watch_location_v2` with its Watch ID and device token.
2. `watch_device` checks the device.
3. `touch_watch` stores battery and network.
4. `insert_watch_location` adds the `location_logs` row.
5. `process_safe_zone_events` may insert an `entry`/`exit` row into
   `geofence_events`. That trigger pushes the guardian.
6. Realtime delivers the new `location_logs` row to the guardian's map.

**SOS**
1. The watch calls `trigger_watch_sos`, or the phone calls
   `trigger_child_phone_sos`.
2. A `sos_alerts` row is inserted (`status = active`). The validate trigger
   checks the guardian–child link, then the notify trigger sends "SOS from …" on
   the SOS channel.
3. Realtime shows the alert in the app.
4. Every minute, `sos-realert` increases `realert_count` on alerts still active,
   which sends "SOS re-alert #N" (up to 10 times).
5. It ends when the guardian calls `acknowledge_my_sos_alert` (status
   `acknowledged`) or the child calls `cancel_watch_sos` (status `cancelled`).

**Pairing a watch**
1. The guardian calls `link_watch_to_my_child` with the Watch ID shown on the
   watch, then `generate_watch_pairing_code`.
2. The child enters the code on the watch, which calls `pair_watch`. It returns
   the device token, and the watch stores it.
3. Unlinking, or linking another watch, clears the token. The old watch's next
   call fails with `28000` and it goes back to the pairing screen.

**Place names**
1. The guardian app reverse-geocodes a point with OpenStreetMap Nominatim, or
   Mapbox as a fallback.
2. It caches the result per cell by calling `save_location_place` (OSM results
   only).
3. Any guardian can read the shared cache: the `location_places` select policy
   is `true`.

---

## 11. Rules and traps (read before changing anything)

1. **Migrations are applied by hand** in the Supabase SQL Editor, not with
   `db push`.
   - Write each one as a **single transaction with preflight checks**.
   - **Never edit an applied migration;** add a new file in
     `supabase/migrations/` named `YYYYMMDD[letter]_name.sql`.
   - The user runs it. Confirm afterwards with a read-only query.
2. **Check constraints use exact values:**
   - `sos_alerts.status` is `cancelled` (not `canceled`).
   - `activation_method` is one of `tap_and_hold`, `tap_hold`, `manual_button`
     or `shake`.
   - `location_logs.source` is `smartwatch` or `mobile`.
   - The `event_type` list is in section 4.
   - `geofences.radius_meters` must be 30–5000.
3. **Silent RLS write failures:** see section 2. Guardian writes to devices,
   persons, alerts and so on must go through an RPC.
4. **New functions:** `security definer`, `set search_path = public`,
   `revoke all ... from public, anon`, then explicit grants. Check ownership
   with `is_guardian_of` or the admin role inside.
5. **plpgsql `returns table (...)`:** output column names shadow table columns.
   Always qualify columns with a table alias.
6. **Never rename `p_*` parameters** of device functions. Old watches and phones
   in use will break with `PGRST202`. Add a `_v2` wrapper.
7. **No hard deletes** of persons, children or devices. Soft-delete
   (`is_active = false`); foreign keys are RESTRICT to keep history owners.
8. **There is no historical battery or network.** Only the latest values exist,
   on `smartwatch_devices`.
9. **`supabase-js` errors are plain objects:** read `error.message`; don't rely
   on `instanceof Error`.
10. **Unit tests write to the live database.** They use the "UT Child One/Two"
    test children; `supabase/cleanup/remove_unit_test_activity.sql` removes
    their rows.
11. **Clean-up candidates found in the live database** (2026-11-15; don't change
    without the owner's OK):
    - **Extra `anon` grants:** the admin and report functions, and
      `save_location_place`, are granted to `anon` (section 5). They check the
      caller inside, but `anon` doesn't need them.
    - **Legacy policy:** `activity_reports` has an old policy, "administrators
      can view activity reports", that uses `private.is_system_administrator()`,
      next to the current `is_safetrack_admin()` one.
    - **Unused tables and functions:** the reserved tables, the backup table
      `geofence_events_removed_ai_notices`, and the `watch-pair` /
      `watch-ingest` edge functions.
    - **`location_logs.travel_mode` still allows `biking`.** Since 2026-11-08 the
      app reads it as `vehicle`.

---

## 12. Checking the live database

Agents can read schema metadata with the linked CLI (the user is already logged
in). Run these from `safe-track/`:

```bash
# Types for every table, view and function (no data):
npx supabase gen types typescript --linked --schema public > /tmp/types.ts

# Read-only SQL (schema metadata):
npx supabase db query --linked --output-format json "select table_name from information_schema.tables where table_schema='public'"
```

- **Only read with it.** Don't select personal data, and **never run DDL or DML
  this way.** Changes go through a migration the user runs in the SQL Editor.
- The publishable key in `.env` **cannot** read the schema (`/rest/v1/` returns 401).

**Useful queries:**
- columns: `information_schema.columns`
- constraints: `pg_constraint` + `pg_get_constraintdef(oid)`
- policies: `pg_policies`
- functions: `pg_proc` (`prosecdef`)
- grants: `information_schema.routine_privileges`
- triggers: `information_schema.triggers`
- jobs: `cron.job`
- realtime tables: `pg_publication_tables where pubname = 'supabase_realtime'`
- buckets: `storage.buckets`

**Where the client code lives:**

| Concern | File |
|---|---|
| Supabase client | `lib/supabase.ts` (env `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
| Sign-in, roles | `services/supabaseAuthService.ts` |
| Children, profile | `services/profileService.ts`, `services/childOnboardingService.ts` |
| Locations, history | `services/locationService.ts`, `services/activityHistoryService.ts` |
| Live map | `services/liveLocationService.ts` |
| SOS | `services/sosService.ts`, `services/safetyEventsService.ts` |
| Safe zones | `services/geofenceService.ts` |
| Watch/phone pairing (guardian side) | `services/smartwatchPairingService.ts`, `services/mobilePairingService.ts`, `services/watchPairingService.ts` |
| Child phone | `services/childMobileService.ts`, `services/childBackgroundLocation.ts` |
| Push | `services/pushRegistrationService.ts`, `services/accountService.ts` (preferences) |
| Admin | `services/adminService.ts`, `services/adminRecordsService.ts`, `services/reportsService.ts`, `services/menuPermissionsService.ts` |
| Place cache | `lib/places.ts` |
| Watch calls | `safe-track-wear-os/app/src/main/java/com/safetrack/watch/data/repository/` (`DeviceRepositoryImpl.kt` pair, `MonitoringRepositoryImpl.kt` heartbeat/location/live, `SosRepositoryImpl.kt` SOS) |
