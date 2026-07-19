from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Survail API"
    environment: str = "development"
    auth_strategy: Literal["discord", "mock"] = "discord"
    database_url: str = "postgresql+psycopg://survail:survail@localhost:5432/survail"
    api_base_url: str = "http://localhost:8000"
    web_base_url: str = "http://localhost:3000"
    session_secret: str = "local-development-secret-change-me"
    session_cookie_name: str = "survail_session"
    session_max_age_seconds: int = 60 * 60 * 24 * 30

    discord_oauth_client_id: str = ""
    discord_oauth_client_secret: str = ""

    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: str = ""
    openai_description_model: str = Field(default="gpt-4.1-mini", min_length=1)
    openai_agent_model: str = Field(default="gpt-4.1-mini", min_length=1)
    openai_import_model: str = Field(default="gpt-5.4", min_length=1)
    openai_role_evaluation_model: str = Field(default="gpt-5.4-mini", min_length=1)
    openai_role_evaluation_reflection_model: str = Field(default="gpt-5.6-luna", min_length=1)
    dspy_role_evaluation_program_path: str | None = None
    deck_description_cache_ttl_seconds: int = Field(default=2_592_000, ge=60)
    scryfall_user_agent: str = Field(default="Survail/0.1", min_length=1)
    scryfall_requests_per_second: float = Field(default=5.0, gt=0, le=9)
    scryfall_search_cache_ttl_seconds: int = Field(default=86_400, ge=60)
    otel_enabled: bool = False
    otel_service_name: str = Field(default="survail-api", min_length=1)
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"
    otel_exporter_otlp_insecure: bool = True
    otel_metric_export_interval_ms: int = Field(default=10_000, ge=1_000)
    otel_capture_agent_content: bool = False

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.environment != "development" and self.auth_strategy == "mock":
            raise ValueError("AUTH_STRATEGY=mock is only allowed in development")
        if (
            self.environment != "development"
            and self.session_secret == "local-development-secret-change-me"
        ):
            raise ValueError("SESSION_SECRET must be configured outside development")
        return self

    @property
    def discord_redirect_uri(self) -> str:
        return f"{self.api_base_url.rstrip('/')}/auth/discord/callback"

    @property
    def discord_configured(self) -> bool:
        return bool(self.discord_oauth_client_id and self.discord_oauth_client_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
