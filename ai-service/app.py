import hashlib
import hmac
import math
import os
from datetime import datetime

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from detect_anomaly import run_ai_detection
from database import get_supabase


# The history the edge functions send is capped at 500 points; anything more
# adds nothing to the current point's features.
MAX_HISTORY = 500


def require_service_key(
    x_safetrack_ai_key: str = Header(default="")
):
    # Every data endpoint needs AI_SERVICE_KEY: this service holds the
    # Supabase service-role key, so it must never be open to the internet.
    # Stripped: a space or newline pasted into a host's settings must not
    # silently break authentication.
    expected = os.getenv("AI_SERVICE_KEY", "").strip()

    if not expected:
        raise HTTPException(
            status_code=500,
            detail="AI_SERVICE_KEY is not configured."
        )

    if not hmac.compare_digest(
        x_safetrack_ai_key.strip().encode(),
        expected.encode()
    ):
        raise HTTPException(status_code=401, detail="Unauthorized.")


def key_fingerprint(value: str) -> str:
    """Length plus the first 8 hex digits of SHA-256: enough to compare two
    copies of the key, useless for recovering it."""
    value = value.strip()
    return f"length {len(value)}, fingerprint {hashlib.sha256(value.encode()).hexdigest()[:8]}" if value else "not set"


# Printed once at startup, so the host's logs show which key is in use.
print(f"[safetrack-ai] AI_SERVICE_KEY: {key_fingerprint(os.getenv('AI_SERVICE_KEY', ''))}", flush=True)


app = FastAPI(
    title="SafeTrack AI Service",
    description="Hybrid AI Anomaly Detection Service",
    version="1.1"
)


class DetectionRequest(BaseModel):
    child_id: str


class ScoreRequest(BaseModel):
    history: list
    current: dict


def _parse_time(value):
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _valid_point(point):
    """A usable location record: real coordinates and a timezone-aware time."""
    if not isinstance(point, dict):
        return False
    try:
        latitude = float(point.get("latitude"))
        longitude = float(point.get("longitude"))
    except (TypeError, ValueError):
        return False
    when = _parse_time(point.get("recorded_at"))
    return (
        math.isfinite(latitude)
        and math.isfinite(longitude)
        and -90 <= latitude <= 90
        and -180 <= longitude <= 180
        and when is not None
        and when.tzinfo is not None
    )


def _normalise(point):
    return {
        **point,
        "latitude": float(point["latitude"]),
        "longitude": float(point["longitude"]),
    }


@app.get("/")
def home():
    return {
        "system": "SafeTrack AI",
        "status": "running"
    }


@app.post("/detect", dependencies=[Depends(require_service_key)])
def detect(request: DetectionRequest):
    try:
        result = run_ai_detection(request.child_id)
        return {
            "success": True,
            "result": result
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@app.post("/score", dependencies=[Depends(require_service_key)])
def score(request: ScoreRequest):
    if not _valid_point(request.current):
        raise HTTPException(
            status_code=422,
            detail="current needs latitude, longitude and a timezone-aware recorded_at.",
        )

    current_time = _parse_time(request.current["recorded_at"])

    # Only strictly earlier points of the history may describe the current
    # one; never let a later point leak into its features. Oldest first.
    history = sorted(
        (
            _normalise(point)
            for point in request.history
            if _valid_point(point) and _parse_time(point["recorded_at"]) < current_time
        ),
        key=lambda point: _parse_time(point["recorded_at"]),
    )[-MAX_HISTORY:]

    from detection.anomaly_detector import SafeTrackAnomalyDetector
    from features.feature_engineering import extract_features

    try:
        features = extract_features(history + [_normalise(request.current)])

        detector = SafeTrackAnomalyDetector()

        if not detector.load():
            return {
                "ready": False,
                "is_anomaly": False,
                "anomaly_score": 0,
                "reasons": [],
                "history_used": len(history),
            }

        prediction = detector.predict(features[-1])

        return {
            "ready": True,
            "is_anomaly": prediction.get("is_anomaly", False),
            "anomaly_score": prediction.get("anomaly_score", 0),
            "reasons": prediction.get("reasons", []),
            "history_used": len(history),
        }

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/anomalies/{child_id}", dependencies=[Depends(require_service_key)])
def anomalies(child_id: str):
    result = (
        get_supabase()
        .table("anomaly_events")
        .select("*")
        .eq("child_id", child_id)
        .order("detected_at", desc=True)
        .execute()
    )

    return {
        "child_id": child_id,
        "count": len(result.data),
        "anomalies": result.data
    }
