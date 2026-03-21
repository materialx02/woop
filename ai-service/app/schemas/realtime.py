from pydantic import BaseModel


class RealtimeMetrics(BaseModel):
    current_speed_kmh: float = 0
    avg_speed_kmh: float = 0
    max_speed_kmh: float = 0
    hard_braking_count: int = 0
    rapid_accel_count: int = 0
    idle_minutes: float = 0
    distance_km: float = 0
    duration_minutes: float = 0
    trip_type: str = "mixed"


class RealtimeRequest(BaseModel):
    vehicle_id: str
    fuel_type: str = "gasoline"
    metrics: RealtimeMetrics


class RealtimeAlert(BaseModel):
    level: str  # "info", "warning", "critical"
    message: str
    category: str  # "speed", "braking", "acceleration", "idling", "efficiency"


class RealtimeResponse(BaseModel):
    alerts: list[RealtimeAlert]
    current_score: int  # 0-100 live driving score
    estimated_efficiency_km_l: float | None
    fuel_saving_tip: str | None
