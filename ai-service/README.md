# SafeTrack AI service

FastAPI service that scores a child's newest location against that child's
own earlier locations with an Isolation Forest, and explains what looked
unusual. It is part of the `safe-track` repository but runs as its own
Python process: the Expo app never talks to it.

```
Watch/phone location ──► Supabase (location_logs)
                              │  scheduled-safety-scan (cron, every minute)
                              │  anomaly-detection (on demand)
                              ▼
           Supabase edge function ── POST /score ──► this service
           (X-SafeTrack-AI-Key)                       │
                              ◄── {ready, is_anomaly, anomaly_score, reasons}
                              │
          geofence_events (event_type = possible_anomaly) ──► guardian push trigger
```

## Endpoints

All except `/` require the header `X-SafeTrack-AI-Key: <AI_SERVICE_KEY>`.
Without `AI_SERVICE_KEY` configured the service rejects every data request
(it fails closed).

| Endpoint | Purpose |
|---|---|
| `GET /` | Health check |
| `POST /score` | `{history: [...], current: {...}}` → `{ready, is_anomaly, anomaly_score, reasons, history_used}`. Used by the edge functions. No database access. |
| `POST /detect` | `{child_id}`: rescans a child's last 500 points and writes `anomaly_events`. Needs Supabase credentials. |
| `GET /anomalies/{child_id}` | Lists `anomaly_events` for a child. Needs Supabase credentials. |

`/score` rules:
- `current` needs `latitude`, `longitude` and a timezone-aware `recorded_at`
  (otherwise 422).
- Only history points **strictly earlier** than `current` are used, sorted
  oldest first and capped at 500. Invalid points are skipped.
- `ready: false` means no usable model: missing, or trained on a different
  feature set. Rerun `train_model.py`.

Features (`features/feature_engineering.py`, order in
`detection/anomaly_detector.py`): distance and speed from the previous point,
the hour in Philippine time (UTC+8), accuracy, the interval since the previous
point, stationary, and source (watch or phone). Changing them requires
retraining.

## Setup (Windows)

```powershell
cd safe-track\ai-service
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
copy .env.example .env   # then fill it in; .env is git-ignored
```

`.env`:

| Variable | Used for |
|---|---|
| `SUPABASE_URL` | Supabase project URL (`/detect`, `/anomalies`, training) |
| `SUPABASE_SERVICE_KEY` | Service-role key. Server only; never put it in the app. |
| `AI_SERVICE_KEY` | Shared secret; must equal the edge functions' `AI_SERVICE_KEY` secret |

## Run, test, train

```powershell
.venv\Scripts\python -m uvicorn app:app --host 0.0.0.0 --port 8000   # run
.venv\Scripts\python -m pytest -q                                     # tests (no Supabase needed)
.venv\Scripts\python train_model.py                                   # retrain from location_logs
```

Training reads every child's `location_logs` with the service-role key,
computes features per child (never across children), and saves
`models/isolation_forest.pkl`. It needs at least 10 records.

## Deploy

The edge functions must reach the service over HTTPS, so run it on a host
with a public URL (for example Render, Railway or Fly.io), using the
`Dockerfile`. Set the three environment variables there. Then in Supabase,
under Edge Functions → Secrets, set:

- `AI_SERVICE_URL=https://<your-host>`
- `AI_SERVICE_KEY=<same secret>`
- `AI_ENABLED=true`

The edge functions only call `/score` once a child has at least 100 earlier
points spanning at least 14 days, and at most one notice per 15 minutes.
