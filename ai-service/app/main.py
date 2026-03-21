from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import efficiency, cost_forecast, driving_score, realtime
from app.services.model_registry import model_registry

app = FastAPI(
    title="FuelWise AI Service",
    description="AI/ML microservice for fuel efficiency prediction, cost forecasting, and driving analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(efficiency.router, prefix="/predict", tags=["Efficiency"])
app.include_router(cost_forecast.router, prefix="/predict", tags=["Cost Forecast"])
app.include_router(driving_score.router, prefix="/analyze", tags=["Driving Analysis"])
app.include_router(realtime.router, prefix="/analyze", tags=["Real-time Analysis"])


@app.on_event("startup")
async def startup():
    model_registry.load_models()


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "models_loaded": model_registry.list_models(),
    }
