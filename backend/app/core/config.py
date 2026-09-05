from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://medrese:medrese@localhost:5432/medrese"
    jwt_secret_key: str = "change-me-to-a-random-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    seed_rector_username: str = "rector"
    seed_rector_password: str = "change-me"
    seed_rector_full_name: str = "Rector Rector"


@lru_cache
def get_settings() -> Settings:
    return Settings()
