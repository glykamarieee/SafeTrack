"""Unit testing, AI Anomaly Detection & Geofencing Module: CASE-064.

The real /score endpoint is called without the service key and with a wrong
one. The actual result is saved to safe-track/__tests__/results/geofencing.json
with the app's other results.

Run (from ai-service): .venv\\Scripts\\python -m pytest tests/test_unit_cases.py -v
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["AI_SERVICE_KEY"] = "test-key"

from fastapi.testclient import TestClient  # noqa: E402

import app as service  # noqa: E402

RESULTS = Path(__file__).resolve().parents[2] / "__tests__" / "results" / "geofencing.json"
POINT = {
    "latitude": 7.0731,
    "longitude": 125.6128,
    "accuracy_meters": 10,
    "source": "smartwatch",
    "recorded_at": "2026-11-08T08:00:00+08:00",
}

client = TestClient(service.app)


def record_actual(case_id, actual):
    data = json.loads(RESULTS.read_text(encoding="utf8")) if RESULTS.exists() else {}
    data[case_id] = {"actual": actual, "date": datetime.now().strftime("%m/%d/%Y")}
    RESULTS.parent.mkdir(parents=True, exist_ok=True)
    RESULTS.write_text(json.dumps(data, indent=2), encoding="utf8")


def test_case_064_request_without_the_correct_key_is_rejected():
    body = {"history": [], "current": POINT}
    missing = client.post("/score", json=body)
    wrong = client.post("/score", json=body, headers={"X-SafeTrack-AI-Key": "wrong-key"})

    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert "ready" not in missing.json() and "ready" not in wrong.json()

    record_actual(
        "CASE-064",
        f'Rejected: no key and a wrong key both got HTTP {missing.status_code} '
        f'("{missing.json().get("detail")}"); no score was returned.',
    )
