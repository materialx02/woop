from fastapi import APIRouter, HTTPException

from app.schemas.cost import CostForecastRequest, CostForecastResponse
from app.models.cost_forecast_model import forecast_fuel_cost

router = APIRouter()


@router.post("/cost", response_model=CostForecastResponse)
async def predict_fuel_cost(request: CostForecastRequest):
    """Forecast fuel prices and recommend best refueling day."""
    if not request.price_history:
        raise HTTPException(
            status_code=400,
            detail="Price history is required for forecasting",
        )

    price_data = [p.model_dump() for p in request.price_history]

    result = forecast_fuel_cost(
        price_history=price_data,
        avg_liters_per_fillup=request.avg_liters_per_fillup,
        forecast_days=7,
    )

    return CostForecastResponse(**result)
