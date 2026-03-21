from pydantic import BaseModel


class TripFeatures(BaseModel):
    distance_km: float
    duration_minutes: float | None = None
    avg_speed_kmh: float | None = None
    max_speed_kmh: float | None = None
    hard_braking_count: int = 0
    rapid_accel_count: int = 0
    idle_minutes: float = 0
    trip_type: str = "mixed"


class EfficiencyRequest(BaseModel):
    vehicle_id: str
    fuel_type: str = "gasoline"
    trips: list[TripFeatures]


class TrainingRequest(BaseModel):
    vehicle_id: str
    fuel_type: str = "gasoline"
    trips: list[TripFeatures]
    efficiencies: list[float]  # Actual km/L for each trip


class TrainingResponse(BaseModel):
    model_key: str
    confidence: float
    samples_used: int
    message: str


class EfficiencyResponse(BaseModel):
    predicted_km_per_liter: float
    confidence: float
    comparison: dict[str, float | None]
    tips: list[str]
