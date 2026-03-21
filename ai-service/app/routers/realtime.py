from fastapi import APIRouter

from app.schemas.realtime import RealtimeRequest, RealtimeResponse
from app.models.realtime_model import analyze_realtime

router = APIRouter()


@router.post("/realtime", response_model=RealtimeResponse)
async def analyze_realtime_driving(request: RealtimeRequest):
    """Analyze current driving metrics and return real-time alerts."""
    metrics = request.metrics.model_dump()
    result = analyze_realtime(metrics, request.fuel_type)
    return RealtimeResponse(**result)
