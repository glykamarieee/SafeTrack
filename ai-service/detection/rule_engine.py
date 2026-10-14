
from datetime import datetime, timezone


def check_geofence_exit(inside_geofence):
    if not inside_geofence:
        return {
            "triggered": True,
            "type": "geofence_exit",
            "severity": "high",
            "reason": "Child exited the assigned safe zone."
        }

    return {"triggered": False}


def check_watch_status(last_seen_at):
    if not last_seen_at:
        return {
            "triggered": True,
            "type": "watch_disconnected",
            "severity": "medium",
            "reason": "Smartwatch connection was lost."
        }

    last_seen = datetime.fromisoformat(
        last_seen_at.replace("Z", "+00:00")
    )

    minutes = (
        datetime.now(timezone.utc) - last_seen
    ).total_seconds() / 60

    if minutes > 5:
        return {
            "triggered": True,
            "type": "watch_disconnected",
            "severity": "medium",
            "reason": "Smartwatch has not sent updates for more than 5 minutes."
        }

    return {"triggered": False}


def check_inactivity(last_location_time):
    last_time = datetime.fromisoformat(
        last_location_time.replace("Z", "+00:00")
    )

    minutes = (
        datetime.now(timezone.utc) - last_time
    ).total_seconds() / 60

    if minutes > 30:
        return {
            "triggered": True,
            "type": "prolonged_inactivity",
            "severity": "medium",
            "reason": "No movement detected for an extended period."
        }

    return {"triggered": False}


def check_sos_event(sos_active):
    if sos_active:
        return {
            "triggered": True,
            "type": "sos_activation",
            "severity": "critical",
            "reason": "SOS emergency alert was activated by the child."
        }

    return {"triggered": False}
