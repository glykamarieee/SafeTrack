"""Live demo of the SafeTrack AI for a presentation.

Sends a child's normal two-week routine (home <-> school in Lapu-Lapu, built
here, no real child's data) to the AI service's /score endpoint, then asks it
about four new locations: two normal, two unusual. Prints what the AI
decided and why.

    .venv\\Scripts\\python demo_ai.py            # the hosted service (Render)
    .venv\\Scripts\\python demo_ai.py --local    # http://127.0.0.1:8000

Reads AI_SERVICE_KEY from ai-service/.env (never printed). Uses only the
standard library, so plain `python demo_ai.py` works too.
"""

import json
import math
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HOSTED = "https://safetrack-ai-qigk.onrender.com"
LOCAL = "http://127.0.0.1:8000"
PH = timezone(timedelta(hours=8))

HOME = (10.2783, 123.9450)  # Ibabao area
SCHOOL = (10.3253, 123.9535)  # Mandaue, across the bridge


def read_key() -> str:
    env = Path(__file__).with_name(".env")
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("AI_SERVICE_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    sys.exit("AI_SERVICE_KEY not found in ai-service/.env")


def point(lat, lng, when, accuracy=15):
    return {
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "accuracy_meters": accuracy,
        "source": "smartwatch",
        "recorded_at": when.astimezone(timezone.utc).isoformat(),
    }


def jitter(place, metres=25):
    d = metres / 111_000
    return place[0] + random.uniform(-d, d), place[1] + random.uniform(-d, d)


def routine(days=14):
    """School days 7 AM - 4 PM, home otherwise; a record about every 30 min."""
    random.seed(7)
    start = datetime.now(PH).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
    history = []
    for day in range(days):
        base = start + timedelta(days=day)
        for half_hour in range(12, 44):  # 6:00 AM to 9:30 PM
            when = base + timedelta(minutes=30 * half_hour + random.randint(0, 5))
            hour = when.hour
            if base.weekday() < 5 and 7 <= hour < 16:
                place = SCHOOL
            elif base.weekday() < 5 and hour == 16 and when.minute < 30:
                # On the way home: halfway, on the road.
                place = ((HOME[0] + SCHOOL[0]) / 2, (HOME[1] + SCHOOL[1]) / 2)
            else:
                place = HOME
            history.append(point(*jitter(place), when))
    return history


def score(url, key, history, current):
    body = json.dumps({"history": history, "current": current}).encode()
    request = urllib.request.Request(
        f"{url}/score",
        data=body,
        headers={"Content-Type": "application/json", "X-SafeTrack-AI-Key": key},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read())


def wake(url):
    print(f"Waking the AI service at {url} (the free plan sleeps; up to a minute)...")
    started = time.time()
    for _ in range(12):
        try:
            with urllib.request.urlopen(url + "/", timeout=60) as response:
                status = json.loads(response.read()).get("status")
                print(f"  AI service is {status} ({time.time() - started:.0f} s)\n")
                return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5)
    sys.exit("The AI service did not answer. Check the internet connection and try again.")


def main():
    url = LOCAL if "--local" in sys.argv else HOSTED
    key = read_key()
    wake(url)

    history = routine(15)
    print(f"Normal routine: {len(history)} records over 14 days (home <-> school).")
    print()

    # Each new location is compared with the routine up to just before it,
    # the way real records arrive one after another.
    today = datetime.now(PH).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
    while today.weekday() >= 5:
        today -= timedelta(days=1)

    def before(when):
        return [p for p in history if datetime.fromisoformat(p["recorded_at"]) < when]

    evening = today.replace(hour=19, minute=10)
    morning = today.replace(hour=10, minute=10)
    night = (today + timedelta(days=1)).replace(hour=2, minute=40)
    cases = [
        ("At home in the evening", evening, point(*jitter(HOME), evening)),
        ("At school on a school morning", morning, point(*jitter(SCHOOL), morning)),
        ("40 km away, 10 min after being home", evening, point(HOME[0] + 0.36, HOME[1], evening)),
        ("2:40 AM, 6 km from home, unknown place", night, point(HOME[0] - 0.054, HOME[1] + 0.02, night)),
    ]

    print(f"{'NEW LOCATION':<44} {'AI RESULT':<20} {'SCORE':>5}  WHY")
    print("-" * 110)
    for label, when, current in cases:
        result = score(url, key, before(when), current)
        if not result.get("ready"):
            verdict = "model not loaded"
        elif result.get("is_anomaly"):
            verdict = "UNUSUAL -> notice"
        else:
            verdict = "normal"
        reasons = ", ".join(result.get("reasons") or []) or "-"
        print(f"{label:<44} {verdict:<20} {result.get('anomaly_score', 0):>5.2f}  {reasons}")

    print(
        "\nAn UNUSUAL result becomes a 'Possible unusual movement' notice for the guardian"
        " (advisory only; it never sends an SOS)."
    )


if __name__ == "__main__":
    main()
