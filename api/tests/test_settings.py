import pytest
from pydantic import ValidationError

from survail.settings import Settings


def settings(
    *,
    api_base_url: str = "http://localhost:8000",
    discord_oauth_client_id: str = "",
    discord_oauth_client_secret: str = "",
    environment: str = "development",
    auth_strategy: str = "discord",
    session_secret: str = "local-development-secret-change-me",
) -> Settings:
    return Settings.model_validate(
        {
            "api_base_url": api_base_url,
            "discord_oauth_client_id": discord_oauth_client_id,
            "discord_oauth_client_secret": discord_oauth_client_secret,
            "environment": environment,
            "auth_strategy": auth_strategy,
            "session_secret": session_secret,
        }
    )


def test_discord_redirect_uri_normalizes_trailing_slash() -> None:
    configured = settings(api_base_url="https://api.example.test/")

    assert configured.discord_redirect_uri == "https://api.example.test/auth/discord/callback"


def test_discord_requires_both_oauth_credentials() -> None:
    assert not settings().discord_configured
    assert not settings(discord_oauth_client_id="client-id").discord_configured
    assert not settings(discord_oauth_client_secret="client-secret").discord_configured
    assert settings(
        discord_oauth_client_id="client-id",
        discord_oauth_client_secret="client-secret",
    ).discord_configured


def test_unknown_settings_are_ignored() -> None:
    configured = Settings.model_validate({"unknown_setting": "ignored"})

    assert configured.app_name == "Survail API"


def test_non_development_environment_requires_session_secret() -> None:
    with pytest.raises(ValidationError):
        settings(environment="production")


def test_mock_auth_is_development_only() -> None:
    assert settings(auth_strategy="mock").auth_strategy == "mock"

    with pytest.raises(ValidationError):
        settings(
            auth_strategy="mock",
            environment="production",
            session_secret="configured-production-secret",
        )
