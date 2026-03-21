import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import cross_val_score


TRIP_TYPE_MAP = {"city": 0, "highway": 1, "mixed": 2, "manual": 3}


def build_features(trips: list[dict]) -> pd.DataFrame:
    """Transform raw trip data into model features."""
    rows = []
    for trip in trips:
        rows.append({
            "distance_km": trip["distance_km"],
            "duration_minutes": trip.get("duration_minutes") or 0,
            "avg_speed_kmh": trip.get("avg_speed_kmh") or 0,
            "max_speed_kmh": trip.get("max_speed_kmh") or 0,
            "hard_braking_count": trip.get("hard_braking_count", 0),
            "rapid_accel_count": trip.get("rapid_accel_count", 0),
            "idle_minutes": trip.get("idle_minutes", 0),
            "trip_type_encoded": TRIP_TYPE_MAP.get(trip.get("trip_type", "mixed"), 2),
            "speed_variance": abs((trip.get("max_speed_kmh") or 0) - (trip.get("avg_speed_kmh") or 0)),
            "idle_ratio": (
                (trip.get("idle_minutes", 0) / trip.get("duration_minutes", 1))
                if trip.get("duration_minutes")
                else 0
            ),
            "events_per_km": (
                (trip.get("hard_braking_count", 0) + trip.get("rapid_accel_count", 0))
                / max(trip["distance_km"], 0.1)
            ),
        })
    return pd.DataFrame(rows)


def train_efficiency_model(
    trips: list[dict], efficiencies: list[float]
) -> tuple[GradientBoostingRegressor, float]:
    """
    Train a Gradient Boosting model to predict km/L.
    Returns (model, cross_val_r2_score).
    """
    X = build_features(trips)
    y = np.array(efficiencies)

    model = GradientBoostingRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42,
    )

    # Cross-validate if enough data
    if len(y) >= 10:
        scores = cross_val_score(model, X, y, cv=min(5, len(y)), scoring="r2")
        confidence = max(0, float(np.mean(scores)))
    else:
        confidence = 0.5  # Low confidence with little data

    model.fit(X, y)
    return model, confidence


def predict_efficiency(
    model: GradientBoostingRegressor, trips: list[dict]
) -> tuple[float, list[str]]:
    """Predict km/L for given trip features and generate tips."""
    X = build_features(trips)
    predictions = model.predict(X)
    avg_prediction = float(np.mean(predictions))

    tips = []

    # Analyze features for tips
    avg_braking = np.mean([t.get("hard_braking_count", 0) for t in trips])
    avg_accel = np.mean([t.get("rapid_accel_count", 0) for t in trips])
    avg_idle = np.mean([t.get("idle_minutes", 0) for t in trips])
    avg_speed = np.mean([t.get("avg_speed_kmh", 0) for t in trips if t.get("avg_speed_kmh")])

    if avg_braking > 3:
        tips.append(f"Reduce hard braking (avg {avg_braking:.0f}/trip) — could save ~3% fuel")
    if avg_accel > 3:
        tips.append(f"Ease off rapid acceleration (avg {avg_accel:.0f}/trip) — smooth driving saves fuel")
    if avg_idle > 5:
        tips.append(f"Reduce idling (avg {avg_idle:.0f} min/trip) — turn off engine when stopped >1 min")
    if avg_speed > 100:
        tips.append("Drive at 70-80 km/h on highways for optimal fuel efficiency")
    elif avg_speed > 0 and avg_speed < 20:
        tips.append("Heavy traffic detected — consider alternate routes to improve efficiency")

    if not tips:
        tips.append("Your driving patterns look efficient. Keep it up!")

    return avg_prediction, tips
