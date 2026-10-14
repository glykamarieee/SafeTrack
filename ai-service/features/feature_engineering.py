
import math
from datetime import datetime, timedelta, timezone


# SafeTrack runs in the Philippines (UTC+8, no daylight saving): the "hour"
# feature and the night-hours rule use local time, not UTC.
LOCAL_TZ = timezone(timedelta(hours=8))


def calculate_distance(lat1, lon1, lat2, lon2):
    earth_radius = 6371000

    lat_difference = math.radians(lat2 - lat1)
    lon_difference = math.radians(lon2 - lon1)

    a = (
        math.sin(lat_difference / 2) ** 2
        +
        math.cos(math.radians(lat1))
        *
        math.cos(math.radians(lat2))
        *
        math.sin(lon_difference / 2) ** 2
    )

    return (
        earth_radius
        * 2
        * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    )


def extract_features(records):
    features = []

    previous = None

    for record in records:

        distance = 0
        speed_kmh = 0
        interval_seconds = 0

        current_time = datetime.fromisoformat(
            record["recorded_at"].replace("Z", "+00:00")
        )

        if previous:

            previous_time = datetime.fromisoformat(
                previous["recorded_at"].replace("Z", "+00:00")
            )

            interval_seconds = max(
                (current_time - previous_time).total_seconds(),
                1
            )

            distance = calculate_distance(
                previous["latitude"],
                previous["longitude"],
                record["latitude"],
                record["longitude"]
            )

            speed_kmh = (
                distance / interval_seconds
            ) * 3.6

        features.append({

            "distance_meters": distance,

            "speed_kmh": speed_kmh,

            "hour": current_time.astimezone(LOCAL_TZ).hour,

            "accuracy":
                float(record.get("accuracy_meters") or 0),

            "movement_interval":
                interval_seconds,

            "stationary":
                1 if distance < 5 else 0,

            "source":
                1 if record.get("source") == "smartwatch" else 0

        })

        previous = record

    return features
