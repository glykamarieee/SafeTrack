"""Tests for the /score endpoint and the feature pipeline.

They use a small model trained on synthetic data in a temporary folder, so
they need no Supabase access and never touch models/isolation_forest.pkl.
Run from ai-service/:  .venv/Scripts/python -m pytest -q
"""

import math
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["AI_SERVICE_KEY"] = "test-key"

from fastapi.testclient import TestClient  # noqa: E402

import app as service  # noqa: E402
from detection import anomaly_detector  # noqa: E402
from detection.anomaly_detector import FEATURE_ORDER, SafeTrackAnomalyDetector  # noqa: E402
from features.feature_engineering import extract_features  # noqa: E402

KEY = {"X-SafeTrack-AI-Key": "test-key"}
START = datetime(2026, 10, 1, 0, 0, tzinfo=timezone.utc)  # 08:00 in Manila


def walk(count=120, minutes=5):
    """A child moving slowly around a block in Manila, one point every 5 min."""
    points = []
    for index in range(count):
        angle = index / 12
        points.append({
            "latitude": 14.5995 + 0.001 * math.sin(angle),
            "longitude": 120.9842 + 0.001 * math.cos(angle),
            "accuracy_meters": 12,
            "source": "smartwatch",
            "recorded_at": (START + timedelta(minutes=index * minutes)).isoformat(),
        })
    return points


@pytest.fixture(autouse=True)
def temp_model(tmp_path, monkeypatch):
    monkeypatch.setattr(anomaly_detector, "MODELS_DIR", str(tmp_path))
    monkeypatch.setattr(anomaly_detector, "MODEL_PATH", str(tmp_path / "model.pkl"))
    yield tmp_path


def train_small_model():
    SafeTrackAnomalyDetector().train(extract_features(walk(400)))


client = TestClient(service.app)


def score(body, headers=KEY):
    return client.post("/score", json=body, headers=headers)


def test_missing_key_is_rejected():
    response = score({"history": [], "current": walk(1)[0]}, headers={})
    assert response.status_code == 401


def test_wrong_key_is_rejected():
    response = score({"history": [], "current": walk(1)[0]}, headers={"X-SafeTrack-AI-Key": "nope"})
    assert response.status_code == 401


def test_unconfigured_key_fails_closed(monkeypatch):
    monkeypatch.delenv("AI_SERVICE_KEY")
    response = score({"history": [], "current": walk(1)[0]})
    assert response.status_code == 500


@pytest.mark.parametrize(
    "current",
    [
        {},
        {"latitude": 14.6, "longitude": 121.0},
        {"latitude": "abc", "longitude": 121.0, "recorded_at": START.isoformat()},
        {"latitude": 95, "longitude": 121.0, "recorded_at": START.isoformat()},
        {"latitude": 14.6, "longitude": 121.0, "recorded_at": "yesterday"},
        {"latitude": 14.6, "longitude": 121.0, "recorded_at": "2026-10-01T08:00:00"},  # no timezone
    ],
)
def test_invalid_current_point_is_422(current):
    train_small_model()
    assert score({"history": walk(5), "current": current}).status_code == 422


def test_missing_body_fields_is_422():
    assert client.post("/score", json={"current": walk(1)[0]}, headers=KEY).status_code == 422


def test_without_a_model_it_is_not_ready():
    points = walk(10)
    response = score({"history": points[:-1], "current": points[-1]})
    assert response.status_code == 200
    assert response.json()["ready"] is False
    assert response.json()["is_anomaly"] is False


def test_model_with_wrong_feature_count_is_treated_as_missing(temp_model):
    from sklearn.ensemble import IsolationForest
    import joblib
    import numpy as np

    joblib.dump(IsolationForest().fit(np.zeros((20, 4))), temp_model / "model.pkl")
    points = walk(10)
    assert score({"history": points[:-1], "current": points[-1]}).json()["ready"] is False


def test_normal_point_scores_as_normal():
    train_small_model()
    points = walk(130)
    body = score({"history": points[:-1], "current": points[-1]}).json()
    assert body["ready"] is True
    assert body["is_anomaly"] is False
    assert body["history_used"] == 129


def test_teleport_at_night_is_flagged_with_reasons():
    train_small_model()
    points = walk(130)
    last = points[-1]
    jump = {
        **last,
        # 30 km away, two minutes later, at 2 am Manila time.
        "latitude": 14.87,
        "longitude": 121.0,
        "accuracy_meters": 300,
        "recorded_at": "2026-10-02T18:00:00+00:00",
    }
    points[-1]["recorded_at"] = "2026-10-02T17:58:00+00:00"
    body = score({"history": points, "current": jump}).json()
    assert body["ready"] is True
    assert body["is_anomaly"] is True
    assert "unusually high travel speed" in body["reasons"]
    assert "activity at an unusual hour" in body["reasons"]


def test_only_strictly_earlier_history_is_used():
    train_small_model()
    points = walk(50)
    current = points[25]
    # Includes the current point itself and 24 later ones; all must be ignored.
    body = score({"history": points, "current": current}).json()
    assert body["history_used"] == 25


def test_unsorted_history_gives_the_same_result():
    train_small_model()
    points = walk(60)
    ordered = score({"history": points[:-1], "current": points[-1]}).json()
    shuffled = score({"history": list(reversed(points[:-1])), "current": points[-1]}).json()
    assert ordered == shuffled


def test_invalid_history_points_are_skipped():
    train_small_model()
    points = walk(20)
    history = points[:-1] + [{"latitude": None}, "junk", {"latitude": 1, "longitude": 2}]
    body = score({"history": history, "current": points[-1]}).json()
    assert body["history_used"] == 19


def test_history_is_capped():
    train_small_model()
    points = walk(700, minutes=1)
    body = score({"history": points[:-1], "current": points[-1]}).json()
    assert body["history_used"] == service.MAX_HISTORY


def test_features_have_the_model_dimension():
    features = extract_features(walk(3))
    assert all(len(SafeTrackAnomalyDetector()._vector(item)) == len(FEATURE_ORDER) for item in features)


def test_hour_feature_is_manila_time():
    feature = extract_features([{**walk(1)[0], "recorded_at": "2026-10-01T16:30:00Z"}])[0]
    assert feature["hour"] == 0  # 16:30 UTC is 00:30 in Manila


def test_service_starts_without_supabase_credentials(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    assert client.get("/").json()["status"] == "running"
