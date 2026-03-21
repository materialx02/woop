def analyze_realtime(metrics: dict, fuel_type: str = "gasoline") -> dict:
    """
    Analyze current driving metrics and return real-time alerts and score.
    Designed to be called frequently during an active trip.
    """
    alerts = []
    score = 100  # Start perfect, deduct for issues

    speed = metrics.get("current_speed_kmh", 0)
    avg_speed = metrics.get("avg_speed_kmh", 0)
    max_speed = metrics.get("max_speed_kmh", 0)
    braking = metrics.get("hard_braking_count", 0)
    accel = metrics.get("rapid_accel_count", 0)
    idle = metrics.get("idle_minutes", 0)
    distance = metrics.get("distance_km", 0)
    duration = metrics.get("duration_minutes", 0)

    # --- Speed alerts ---
    if speed > 120:
        alerts.append({
            "level": "critical",
            "message": f"Speed {speed:.0f} km/h — fuel consumption increases sharply above 100 km/h",
            "category": "speed",
        })
        score -= 20
    elif speed > 100:
        alerts.append({
            "level": "warning",
            "message": "High speed detected — optimal fuel efficiency is at 60-80 km/h",
            "category": "speed",
        })
        score -= 10
    elif 60 <= speed <= 80:
        alerts.append({
            "level": "info",
            "message": "Great cruising speed for fuel efficiency",
            "category": "speed",
        })

    # --- Braking alerts ---
    if distance > 0:
        braking_per_km = braking / max(distance, 0.1)
        if braking_per_km > 5:
            alerts.append({
                "level": "critical",
                "message": f"{braking} hard brakes in {distance:.1f} km — anticipate stops to save fuel and brakes",
                "category": "braking",
            })
            score -= 20
        elif braking_per_km > 2:
            alerts.append({
                "level": "warning",
                "message": "Frequent hard braking detected — try to maintain a greater following distance",
                "category": "braking",
            })
            score -= 10

    # --- Acceleration alerts ---
    if distance > 0:
        accel_per_km = accel / max(distance, 0.1)
        if accel_per_km > 5:
            alerts.append({
                "level": "critical",
                "message": f"{accel} rapid accelerations — aggressive driving can increase fuel use by 33%",
                "category": "acceleration",
            })
            score -= 20
        elif accel_per_km > 2:
            alerts.append({
                "level": "warning",
                "message": "Rapid acceleration detected — ease into the pedal for better efficiency",
                "category": "acceleration",
            })
            score -= 10

    # --- Idling alerts ---
    if duration > 0:
        idle_ratio = idle / duration
        if idle_ratio > 0.3:
            alerts.append({
                "level": "warning",
                "message": f"Engine idling for {idle:.0f} min ({idle_ratio*100:.0f}% of trip) — turn off when stopped >1 min",
                "category": "idling",
            })
            score -= 15
        elif idle_ratio > 0.15:
            alerts.append({
                "level": "info",
                "message": "Moderate idling time — consider turning off engine at long stops",
                "category": "idling",
            })
            score -= 5

    # --- Estimated efficiency ---
    base_efficiency = {
        "gasoline": 12.0,
        "diesel": 14.0,
        "hybrid": 18.0,
        "ev": 6.0,
    }.get(fuel_type, 12.0)

    adjustment = 0.0
    if avg_speed > 0:
        if 60 <= avg_speed <= 80:
            adjustment += 2.0
        elif avg_speed > 100:
            adjustment -= 3.0
        elif avg_speed < 20:
            adjustment -= 2.0

    if distance > 0:
        events_per_km = (braking + accel) / max(distance, 0.1)
        adjustment -= min(events_per_km * 0.3, 3.0)

    estimated = max(base_efficiency + adjustment, base_efficiency * 0.5)

    # --- Fuel saving tip ---
    tip = None
    if alerts:
        worst = max(alerts, key=lambda a: {"critical": 3, "warning": 2, "info": 1}.get(a["level"], 0))
        if worst["level"] != "info":
            tip = worst["message"]

    if not tip:
        tip = "You're driving efficiently — keep it up!"

    score = max(0, min(100, score))

    return {
        "alerts": alerts,
        "current_score": score,
        "estimated_efficiency_km_l": round(estimated, 1),
        "fuel_saving_tip": tip,
    }
