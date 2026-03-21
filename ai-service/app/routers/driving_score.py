from fastapi import APIRouter, HTTPException

from app.schemas.driving import DrivingAnalysisRequest, DrivingAnalysisResponse
from app.models.driving_behavior_model import analyze_driving

router = APIRouter()


@router.post("/driving", response_model=DrivingAnalysisResponse)
async def analyze_driving_behavior(request: DrivingAnalysisRequest):
    """Analyze driving behavior and return score with recommendations."""
    if not request.trips:
        raise HTTPException(status_code=400, detail="At least one trip is required")

    trips = [t.model_dump() for t in request.trips]
    result = analyze_driving(trips)

    return DrivingAnalysisResponse(**result)
