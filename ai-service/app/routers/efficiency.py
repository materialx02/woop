from fastapi import APIRouter, HTTPException

from app.schemas.efficiency import EfficiencyRequest, EfficiencyResponse, TrainingRequest, TrainingResponse
from app.models.efficiency_model import (
    train_efficiency_model,
    predict_efficiency,
    build_features,
)
from app.services.model_registry import model_registry

router = APIRouter()


@router.post("/efficiency", response_model=EfficiencyResponse)
async def predict_fuel_efficiency(request: EfficiencyRequest):
    """Predict fuel efficiency (km/L) based on trip data."""
    if not request.trips:
        raise HTTPException(status_code=400, detail="At least one trip is required")

    trips = [t.model_dump() for t in request.trips]
    model_key = f"efficiency:{request.vehicle_id}"

    model = model_registry.get(model_key)

    if model is not None:
        # Use existing trained model
        prediction, tips = predict_efficiency(model, trips)
        metadata = model_registry.get_metadata(model_key) or {}
        confidence = metadata.get("confidence", 0.5)
    else:
        # No trained model — use heuristic based on trip features
        prediction, tips, confidence = _heuristic_prediction(trips, request.fuel_type)

    # Comparison stats
    if len(trips) > 1:
        all_speeds = [t.get("avg_speed_kmh", 0) for t in trips if t.get("avg_speed_kmh")]
        comparison = {
            "avg_speed": float(sum(all_speeds) / len(all_speeds)) if all_speeds else None,
            "avg_braking": float(
                sum(t.get("hard_braking_count", 0) for t in trips) / len(trips)
            ),
            "avg_idle_minutes": float(
                sum(t.get("idle_minutes", 0) for t in trips) / len(trips)
            ),
        }
    else:
        comparison = {}

    return EfficiencyResponse(
        predicted_km_per_liter=round(prediction, 2),
        confidence=round(confidence, 3),
        comparison=comparison,
        tips=tips,
    )


@router.post("/efficiency/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest):
    """Train/retrain the efficiency model for a vehicle using correlated trip+fuel data."""
    if len(request.trips) < 5:
        raise HTTPException(
            status_code=400,
            detail="At least 5 trips with fuel data are required for training",
        )

    if len(request.trips) != len(request.efficiencies):
        raise HTTPException(
            status_code=400,
            detail="trips and efficiencies must have the same length",
        )

    # Filter out invalid efficiencies (<=0 or unreasonably high)
    valid = [
        (t, e)
        for t, e in zip(request.trips, request.efficiencies)
        if 0 < e < 100
    ]

    if len(valid) < 5:
        raise HTTPException(
            status_code=400,
            detail=f"Only {len(valid)} valid trip-efficiency pairs found. Need at least 5.",
        )

    trips = [t.model_dump() for t, _ in valid]
    efficiencies = [e for _, e in valid]

    model, confidence = train_efficiency_model(trips, efficiencies)

    model_key = f"efficiency:{request.vehicle_id}"
    model_registry.save(model_key, model, metadata={
        "confidence": confidence,
        "samples": len(valid),
        "fuel_type": request.fuel_type,
    })

    return TrainingResponse(
        model_key=model_key,
        confidence=round(confidence, 3),
        samples_used=len(valid),
        message=f"Model trained with {len(valid)} samples (R² ≈ {confidence:.2f})",
    )


def _heuristic_prediction(
    trips: list[dict], fuel_type: str
) -> tuple[float, list[str], float]:
    """Heuristic prediction when no trained model exists."""
    # Base km/L by fuel type
    base_efficiency = {
        "gasoline": 12.0,
        "diesel": 14.0,
        "hybrid": 18.0,
        "ev": 6.0,  # km/kWh for EV
    }.get(fuel_type, 12.0)

    adjustments = 0.0
    tips = []

    avg_braking = sum(t.get("hard_braking_count", 0) for t in trips) / len(trips)
    avg_accel = sum(t.get("rapid_accel_count", 0) for t in trips) / len(trips)
    avg_idle = sum(t.get("idle_minutes", 0) for t in trips) / len(trips)
    avg_speed = sum(t.get("avg_speed_kmh", 0) for t in trips if t.get("avg_speed_kmh"))
    speed_count = sum(1 for t in trips if t.get("avg_speed_kmh"))
    avg_speed = avg_speed / speed_count if speed_count else 0

    # Adjust for driving behavior
    if avg_braking > 3:
        adjustments -= 0.5 * avg_braking
        tips.append(f"Hard braking avg {avg_braking:.1f}/trip — reducing this saves ~3% fuel")
    if avg_accel > 3:
        adjustments -= 0.3 * avg_accel
        tips.append(f"Rapid acceleration avg {avg_accel:.1f}/trip — smooth starts save fuel")
    if avg_idle > 5:
        adjustments -= 0.2 * avg_idle
        tips.append(f"High idling ({avg_idle:.0f} min/trip) — engine off when stopped >1 min")

    # Speed adjustments
    if 60 <= avg_speed <= 80:
        adjustments += 1.0  # Optimal highway speed
    elif avg_speed > 100:
        adjustments -= 2.0
        tips.append("High-speed driving reduces efficiency significantly")
    elif avg_speed < 20 and avg_speed > 0:
        adjustments -= 1.5
        tips.append("Low speeds suggest heavy traffic — alternate routes may help")

    # Trip type adjustments
    trip_types = [t.get("trip_type", "mixed") for t in trips]
    highway_ratio = trip_types.count("highway") / len(trip_types)
    if highway_ratio > 0.5:
        adjustments += 1.0

    if not tips:
        tips.append("Log more trips for better predictions. Current estimate is based on averages.")

    prediction = max(base_efficiency + adjustments, base_efficiency * 0.5)
    return prediction, tips, 0.3  # Low confidence for heuristic
