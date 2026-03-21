from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    model_storage_path: Path = Path(__file__).parent.parent / "trained_models"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://materialx02.github.io",
    ]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
