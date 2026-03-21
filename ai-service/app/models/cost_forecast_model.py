import numpy as np
import pandas as pd
from datetime import datetime, timedelta


def forecast_fuel_cost(
    price_history: list[dict],
    avg_liters_per_fillup: float = 30.0,
    forecast_days: int = 7,
) -> dict:
    """
    Forecast fuel prices using weighted moving average with trend detection.
    Falls back from SARIMAX to simpler methods when data is limited.
    """
    if len(price_history) < 3:
        return _insufficient_data_response(price_history, avg_liters_per_fillup)

    df = pd.DataFrame(price_history)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    prices = df["price_per_liter"].values
    dates = df["date"].values

    # Try SARIMAX if enough data, otherwise use weighted moving average
    if len(prices) >= 14:
        forecast_prices = _sarimax_forecast(prices, forecast_days)
        confidence = min(0.85, 0.5 + len(prices) * 0.005)
    else:
        forecast_prices = _weighted_ma_forecast(prices, forecast_days)
        confidence = min(0.7, 0.3 + len(prices) * 0.05)

    # Build forecast dates
    last_date = pd.Timestamp(dates[-1])
    forecast_dates = [last_date + timedelta(days=i + 1) for i in range(forecast_days)]

    forecast = [
        {"date": d.strftime("%Y-%m-%d"), "predicted_price": round(float(p), 4)}
        for d, p in zip(forecast_dates, forecast_prices)
    ]

    # Find best day (lowest price)
    min_idx = int(np.argmin(forecast_prices))
    recommended_day = forecast[min_idx]["date"]
    recommended_price = forecast[min_idx]["predicted_price"]
    projected_cost = round(recommended_price * avg_liters_per_fillup, 2)

    # Detect trend
    if len(prices) >= 3:
        recent_trend = prices[-1] - prices[-3]
        if recent_trend > 0.5:
            trend = "rising"
        elif recent_trend < -0.5:
            trend = "falling"
        else:
            trend = "stable"
    else:
        trend = "stable"

    return {
        "forecast": forecast,
        "recommended_day": recommended_day,
        "recommended_price": recommended_price,
        "projected_cost": projected_cost,
        "trend": trend,
        "confidence": round(confidence, 3),
    }


def _sarimax_forecast(prices: np.ndarray, forecast_days: int) -> np.ndarray:
    """SARIMAX forecast for longer price histories."""
    try:
        from statsmodels.tsa.statespace.sarimax import SARIMAX

        model = SARIMAX(
            prices,
            order=(1, 1, 1),
            seasonal_order=(0, 0, 0, 0),
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        result = model.fit(disp=False, maxiter=100)
        forecast = result.forecast(steps=forecast_days)
        # Ensure no negative prices
        return np.maximum(forecast, prices[-1] * 0.8)
    except Exception:
        return _weighted_ma_forecast(prices, forecast_days)


def _weighted_ma_forecast(prices: np.ndarray, forecast_days: int) -> np.ndarray:
    """Weighted moving average forecast as fallback."""
    window = min(5, len(prices))
    weights = np.arange(1, window + 1, dtype=float)
    weights /= weights.sum()

    recent = prices[-window:]
    wma = np.dot(recent, weights)

    # Simple trend from last few points
    if len(prices) >= 3:
        trend = (prices[-1] - prices[-3]) / 2
    else:
        trend = 0

    forecast = []
    for i in range(forecast_days):
        predicted = wma + trend * (i + 1) * 0.5  # Damped trend
        forecast.append(max(predicted, prices[-1] * 0.8))  # Floor at 80% of last

    return np.array(forecast)


def _insufficient_data_response(
    price_history: list[dict], avg_liters: float
) -> dict:
    """Response when not enough data for forecasting."""
    last_price = price_history[-1]["price_per_liter"] if price_history else 0
    today = datetime.now()

    return {
        "forecast": [
            {
                "date": (today + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
                "predicted_price": last_price,
            }
            for i in range(7)
        ],
        "recommended_day": (today + timedelta(days=1)).strftime("%Y-%m-%d"),
        "recommended_price": last_price,
        "projected_cost": round(last_price * avg_liters, 2),
        "trend": "stable",
        "confidence": 0.1,
    }
