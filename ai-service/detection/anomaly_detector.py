
from sklearn.ensemble import IsolationForest
import numpy as np
import joblib
import os

from explanation.explanation_engine import explain_reasons


# Resolved from this file, so the service works from any working directory.
MODELS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "models"
)

MODEL_PATH = os.path.join(MODELS_DIR, "isolation_forest.pkl")


FEATURE_ORDER = [
    "distance_meters",
    "speed_kmh",
    "hour",
    "accuracy",
    "movement_interval",
    "stationary",
    "source"
]


class SafeTrackAnomalyDetector:

    def __init__(self):

        self.model = IsolationForest(
            n_estimators=150,
            contamination=0.05,
            random_state=42
        )


    def _vector(self, feature):

        return [
            feature.get(name, 0)
            for name in FEATURE_ORDER
        ]


    def train(self, features):

        dataset = np.array(
            [
                self._vector(item)
                for item in features
            ]
        )

        self.model.fit(dataset)

        os.makedirs(
            MODELS_DIR,
            exist_ok=True
        )

        joblib.dump(
            self.model,
            MODEL_PATH
        )

        return True


    def load(self):

        if os.path.exists(MODEL_PATH):

            model = joblib.load(
                MODEL_PATH
            )

            # A model trained on a different feature set cannot score these
            # vectors; treat it as missing until train_model.py is rerun.
            if getattr(model, "n_features_in_", None) != len(FEATURE_ORDER):
                print(
                    "Saved model does not match FEATURE_ORDER; retrain with train_model.py"
                )
                return False

            self.model = model

            return True

        return False


    def predict(self, feature):

        data = np.array(
            [
                self._vector(feature)
            ]
        )

        prediction = self.model.predict(data)[0]

        score = self.model.score_samples(data)[0]

        is_anomaly = bool(prediction == -1)

        return {

            "is_anomaly":
                is_anomaly,

            "reasons":
                explain_reasons(feature) if is_anomaly else [],

            "anomaly_score":
                float(abs(score)),

            "feature_values":
                {
                    key: feature.get(key, 0)
                    for key in FEATURE_ORDER
                }

        }
