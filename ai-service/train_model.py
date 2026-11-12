from datetime import datetime

from database import get_supabase

from features.feature_engineering import extract_features

from detection.anomaly_detector import SafeTrackAnomalyDetector



PAGE_SIZE = 1000

# The same spacing the edge functions use before scoring (thinHistory in
# supabase/functions/_shared/anomaly.ts): the watch saves a point every ~10 s
# while moving, and at that spacing GPS jitter looks like speed spikes.
HISTORY_SPACING_SECONDS = 180

# Children made by the unit tests (CASE-xxx runs). Their points jump between
# test coordinates within a second and are not real movement.
TEST_CHILD_PREFIX = "UT Child"


def get_test_child_ids():

    response = (
        get_supabase()
        .table("persons")
        .select("id")
        .like("full_name", f"{TEST_CHILD_PREFIX}%")
        .execute()
    )

    return {row["id"] for row in response.data}


def thin_history(records, spacing_seconds=HISTORY_SPACING_SECONDS):

    kept = []
    last = None

    for record in records:

        time = datetime.fromisoformat(
            record["recorded_at"].replace("Z", "+00:00")
        )

        if last is not None and (time - last).total_seconds() < spacing_seconds:
            continue

        kept.append(record)
        last = time

    return kept


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
    test_children = get_test_child_ids()

    by_child = {}

    for record in records:
        if record["child_id"] in test_children:
            continue
        by_child.setdefault(record["child_id"], []).append(record)

    print(
        f"Children: {len(by_child)} "
        f"({len(test_children)} unit-test children left out)"
    )

    features = []

    for child_records in by_child.values():
        features.extend(
            extract_features(
                thin_history(child_records)
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