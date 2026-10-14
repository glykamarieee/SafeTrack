from database import get_supabase

from features.feature_engineering import extract_features

from detection.anomaly_detector import SafeTrackAnomalyDetector



PAGE_SIZE = 1000


def get_location_data():

    # PostgREST returns at most 1000 rows per request, so page through.
    records = []
    start = 0

    while True:

        response = (
            get_supabase()
            .table("location_logs")
            .select("*")
            .order(
                "recorded_at",
                desc=False
            )
            .order("id")
            .range(start, start + PAGE_SIZE - 1)
            .execute()
        )

        records.extend(response.data)

        if len(response.data) < PAGE_SIZE:
            return records

        start += PAGE_SIZE



def train():

    print(
        "Fetching SafeTrack location history..."
    )


    records = get_location_data()


    if len(records) < 10:

        print(
            "Not enough location data for training."
        )

        return



    print(
        f"Loaded {len(records)} location records"
    )



    print(
        "Extracting AI features..."
    )


    # Distance and speed only make sense between points of the same child.
    by_child = {}

    for record in records:
        by_child.setdefault(record["child_id"], []).append(record)

    features = []

    for child_records in by_child.values():
        features.extend(
            extract_features(
                child_records
            )
        )



    print(
        f"Generated {len(features)} feature samples"
    )



    print(
        "Training Isolation Forest..."
    )


    detector = SafeTrackAnomalyDetector()


    detector.train(
        features
    )


    print(
        "AI model training complete."
    )



if __name__ == "__main__":

    train()