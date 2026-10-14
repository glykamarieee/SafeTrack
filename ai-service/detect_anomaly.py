from features.data_validation import validate_location
from database import get_supabase
from features.feature_engineering import extract_features
from detection.anomaly_detector import SafeTrackAnomalyDetector
from explanation.explanation_engine import generate_explanation


def get_latest_locations(child_id, limit=500):
    result = (
        get_supabase()
        .table("location_logs")
        .select("*")
        .eq("child_id", child_id)
        .order("recorded_at", desc=True)
        .limit(limit)
        .execute()
    )

    return result.data


def save_anomaly(child_id, location_id, score, reason, details):
    get_supabase().table("anomaly_events").insert({
        "child_id": child_id,
        "location_log_id": location_id,
        "detection_type": "ai_anomaly",
        "severity": "medium",
        "anomaly_score": score,
        "reason": reason,
        "details": details
    }).execute()


def run_ai_detection(child_id):

    locations = get_latest_locations(child_id)

    valid = []
    previous = None

    for location in reversed(locations):
        if validate_location(previous, location):
            valid.append(location)
            previous = location

    if not valid:
        return {
            "ready": False,
            "anomalies": 0
        }

    # valid is oldest first; features[i] describes valid[i].
    features = extract_features(valid)

    detector = SafeTrackAnomalyDetector()

    if not detector.load():
        return {
            "ready": False,
            "reason": "Model unavailable"
        }

    count = 0

    for index, feature in enumerate(features):

        prediction = detector.predict(feature)

        if prediction.get("is_anomaly"):

            location = valid[index]

            explanation = generate_explanation(feature)

            save_anomaly(
                child_id,
                location["id"],
                prediction.get("anomaly_score", 0),
                explanation["reason"],
                explanation["details"]
            )

            count += 1

    return {
        "ready": True,
        "anomalies": count
    }
