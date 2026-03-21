from pydantic import BaseModel


class PriceDataPoint(BaseModel):
    date: str
    price_per_liter: float


class FillUpDataPoint(BaseModel):
    date: str
    liters: float
    price_per_liter: float
    total_cost: float


class CostForecastRequest(BaseModel):
    region: str = "NCR"
    fuel_type: str = "gasoline"
    price_history: list[PriceDataPoint]
    fill_ups: list[FillUpDataPoint] = []
    avg_liters_per_fillup: float = 30.0


class DayForecast(BaseModel):
    date: str
    predicted_price: float


class CostForecastResponse(BaseModel):
    forecast: list[DayForecast]
    recommended_day: str
    recommended_price: float
    projected_cost: float
    trend: str  # "rising", "falling", "stable"
    confidence: float
