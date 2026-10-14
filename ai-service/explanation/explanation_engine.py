
# Plain-language reasons for a flagged location, built from its features.
# The Isolation Forest only says "unusual"; these rules say what stood out.

HIGH_SPEED_KMH = 80
LARGE_JUMP_METERS = 2000
LOW_ACCURACY_METERS = 100
LONG_GAP_SECONDS = 6 * 60 * 60
NIGHT_HOURS = {22, 23, 0, 1, 2, 3, 4}


def explain_reasons(feature):
    reasons = []

    if feature.get("speed_kmh", 0) > HIGH_SPEED_KMH:
        reasons.append("unusually high travel speed")

    if feature.get("distance_meters", 0) > LARGE_JUMP_METERS:
        reasons.append("large distance from the previous location")

    if feature.get("hour") in NIGHT_HOURS:
        reasons.append("activity at an unusual hour")

    if feature.get("accuracy", 0) > LOW_ACCURACY_METERS:
        reasons.append("low location accuracy")

    if feature.get("movement_interval", 0) > LONG_GAP_SECONDS:
        reasons.append("long gap since the previous location")

    return reasons


def generate_explanation(feature):
    reasons = explain_reasons(feature)

    if reasons:
        reason = "Possible unusual movement: " + ", ".join(reasons) + "."
    else:
        reason = "Possible unusual movement compared with the usual pattern."

    details = (
        f"Distance {feature.get('distance_meters', 0):.0f} m, "
        f"speed {feature.get('speed_kmh', 0):.1f} km/h, "
        f"hour {feature.get('hour', 0)}, "
        f"accuracy {feature.get('accuracy', 0):.0f} m. Advisory only."
    )

    return {
        "reason": reason,
        "details": details,
        "reasons": reasons,
    }
