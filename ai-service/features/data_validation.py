
from features.feature_engineering import calculate_distance

MAX_DISTANCE_METERS = 5000


def validate_location(previous, current):
    """
    Removes impossible GPS jumps.
    Allows first location record.
    """

    if previous is None:
        return True

    distance = calculate_distance(
        previous["latitude"],
        previous["longitude"],
        current["latitude"],
        current["longitude"]
    )

    if distance > MAX_DISTANCE_METERS:
        print(
            "Ignored invalid GPS jump:",
            distance,
            "meters"
        )
        return False

    return True
