import numpy as np


def analyze_driving(trips: list[dict]) -> dict:
    """
    Analyze driving behavior from trip data.
    Returns score (0-100), breakdown, category, tips, and anomalies.
    """
    if not trips:
        return {
            "score": 50,
            "breakdown": {"braking": 12.5, "acceleration": 12.5, "idling": 12.5, "speed": 12.5, "efficiency": 0},
            "category": "fair",
            "tips": ["Start logging trips to get personalized driving insights."],
            "anomalies": [],
        }

    n = len(trips)
    total_braking = sum(t.get("hard_braking_count", 0) for t in trips)
    total_accel = sum(t.get("rapid_accel_count", 0) for t in trips)
    total_idle = sum(t.get("idle_minutes", 0) for t in trips)
    total_duration = sum(t.get("duration_minutes", 0) or 0 for t in trips)
    total_distance = sum(t["distance_km"] for t in trips)

    speeds = [t.get("avg_speed_kmh", 0) for t in trips if t.get("avg_speed_kmh")]
    max_speeds = [t.get("max_speed_kmh", 0) for t in trips if t.get("max_speed_kmh")]
    fuel_consumed = [t.get("fuel_consumed_liters") for t in trips if t.get("fuel_consumed_liters")]

    avg_braking_per_trip = total_braking / n
    avg_accel_per_trip = total_accel / n
    idle_ratio = total_idle / total_duration if total_duration > 0 else 0
    high_speed_count = sum(1 for s in max_speeds if s > 120)
    high_speed_ratio = high_speed_count / n if n > 0 else 0

    # === Score Components (each 0-20, total 0-100) ===

    # Braking score: penalize >2 hard brakes per trip
    braking_score = max(0, 20 - avg_braking_per_trip * 4)

    # Acceleration score: penalize >2 rapid accels per trip
    accel_score = max(0, 20 - avg_accel_per_trip * 4)

    # Idling score: penalize >15% idle ratio
    idling_score = max(0, 20 - idle_ratio * 80)

    # Speed score: penalize excessive speed and high variance
    speed_score = max(0, 20 - high_speed_ratio * 40)
    if speeds:
        speed_variance = float(np.std(speeds))
        if speed_variance > 20:
            speed_score = max(0, speed_score - 5)

    # Efficiency score: bonus for good fuel economy
    efficiency_score = 10  # Baseline
    if fuel_consumed and total_distance > 0:
        total_fuel = sum(fuel_consumed)
        km_per_l = total_distance / total_fuel if total_fuel > 0 else 0
        if km_per_l > 15:
            efficiency_score = 20
        elif km_per_l > 12:
            efficiency_score = 16
        elif km_per_l > 9:
            efficiency_score = 12
        elif km_per_l > 6:
            efficiency_score = 8
        else:
            efficiency_score = 4

    total_score = int(round(braking_score + accel_score + idling_score + speed_score + efficiency_score))
    total_score = max(0, min(100, total_score))

    # === Category ===
    if total_score >= 80:
        category = "excellent"
    elif total_score >= 60:
        category = "good"
    elif total_score >= 40:
        category = "fair"
    else:
        category = "poor"

    # === Tips ===
    tips = []
    if avg_braking_per_trip > 2:
        tips.append(
            f"You average {avg_braking_per_trip:.1f} hard brakes per trip. "
            "Anticipate stops by looking further ahead — saves brakes and ~3% fuel."
        )
    if avg_accel_per_trip > 2:
        tips.append(
            f"You average {avg_accel_per_trip:.1f} rapid accelerations per trip. "
            "Accelerate gradually from stops to save fuel."
        )
    if idle_ratio > 0.15:
        tips.append(
            f"Idling accounts for {idle_ratio * 100:.0f}% of your driving time. "
            "Turn off the engine when stopped for more than 1 minute."
        )
    if high_speed_ratio > 0.3:
        tips.append(
            f"{high_speed_count} of your last {n} trips exceeded 120 km/h. "
            "Driving at 70-80 km/h on highways is the sweet spot for fuel efficiency."
        )
    if speeds and np.mean(speeds) < 20:
        tips.append(
            "Your average speed is very low — likely heavy traffic. "
            "Consider alternate routes or off-peak driving times."
        )
    if not tips:
        tips.append("Excellent driving habits! Your patterns are fuel-efficient.")

    # === Anomaly Detection ===
    anomalies = []
    if fuel_consumed:
        km_per_l_values = []
        for t in trips:
            if t.get("fuel_consumed_liters") and t["distance_km"] > 0:
                km_per_l_values.append(t["distance_km"] / t["fuel_consumed_liters"])

        if len(km_per_l_values) >= 3:
            mean_eff = np.mean(km_per_l_values)
            std_eff = np.std(km_per_l_values)
            if std_eff > 0:
                for i, val in enumerate(km_per_l_values):
                    z_score = abs(val - mean_eff) / std_eff
                    if z_score > 2:
                        direction = "lower" if val < mean_eff else "higher"
                        anomalies.append(
                            f"Trip {i + 1} had unusually {direction} efficiency "
                            f"({val:.1f} km/L vs avg {mean_eff:.1f} km/L)"
                        )

    return {
        "score": total_score,
        "breakdown": {
            "braking": round(braking_score, 1),
            "acceleration": round(accel_score, 1),
            "idling": round(idling_score, 1),
            "speed": round(speed_score, 1),
            "efficiency": round(efficiency_score, 1),
        },
        "category": category,
        "tips": tips,
        "anomalies": anomalies,
    }
