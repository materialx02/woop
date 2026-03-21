from pydantic import BaseModel


class TripData(BaseModel):
    distance_km: float
    duration_minutes: float | None = None
    avg_speed_kmh: float | None = None
    max_speed_kmh: float | None = None
    hard_braking_count: int = 0
    rapid_accel_count: int = 0
    idle_minutes: float = 0
    trip_type: str = "mixed"
    fuel_consumed_liters: float | None = None


class DrivingAnalysisRequest(BaseModel):
    vehicle_id: str
    trips: list[TripData]


class ScoreBreakdown(BaseModel):
    braking: float
    acceleration: float
    idling: float
    speed: float
    efficiency: float


class DrivingAnalysisResponse(BaseModel):
    score: int
    breakdown: ScoreBreakdown
    category: str  # "excellent", "good", "fair", "poor"
    tips: list[str]
    anomalies: list[str]
