"""Configuration module for deployment settings and environment variables."""

from .config import (
    AZURE_OPENAI_API_KEY,
    DATABASE_URL,
    LANGSMITH_API_KEY,
    LANGSMITH_PROJECT,
    LANGSMITH_TRACING,
    LANGSMITH_WORKSPACE_ID,
    ConfigError,
    is_langsmith_enabled,
)
from .deployments import (
    GPT_5_1,
    TEXT_EMBEDDING_3_LARGE,
    DEPLOYMENTS,
    get_deployment,
)

__all__ = [
    # Config variables
    "AZURE_OPENAI_API_KEY",
    "DATABASE_URL",
    "LANGSMITH_API_KEY",
    "LANGSMITH_PROJECT",
    "LANGSMITH_TRACING",
    "LANGSMITH_WORKSPACE_ID",
    "ConfigError",
    "is_langsmith_enabled",
    # Deployment configurations
    "GPT_5_1",
    "TEXT_EMBEDDING_3_LARGE",
    "DEPLOYMENTS",
    "get_deployment",
]

