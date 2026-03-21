import joblib
from pathlib import Path
from typing import Any

from app.config import settings


class ModelRegistry:
    """In-memory registry for trained ML models."""

    def __init__(self):
        self._models: dict[str, Any] = {}
        self._metadata: dict[str, dict] = {}

    def load_models(self):
        """Load all saved models from disk at startup."""
        model_dir = settings.model_storage_path
        if not model_dir.exists():
            model_dir.mkdir(parents=True, exist_ok=True)
            return

        for model_file in model_dir.glob("*.joblib"):
            key = model_file.stem
            try:
                self._models[key] = joblib.load(model_file)
                print(f"Loaded model: {key}")
            except Exception as e:
                print(f"Failed to load model {key}: {e}")

    def get(self, key: str) -> Any | None:
        return self._models.get(key)

    def save(self, key: str, model: Any, metadata: dict | None = None):
        """Save model to registry and disk."""
        self._models[key] = model
        if metadata:
            self._metadata[key] = metadata

        model_path = settings.model_storage_path / f"{key}.joblib"
        settings.model_storage_path.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, model_path)
        print(f"Saved model: {key}")

    def list_models(self) -> list[str]:
        return list(self._models.keys())

    def get_metadata(self, key: str) -> dict | None:
        return self._metadata.get(key)


model_registry = ModelRegistry()
