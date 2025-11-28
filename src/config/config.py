"""
Configuration module for application settings.

This module contains hard-coded configuration values and loads required
environment variables (API keys). Raises exceptions if required variables
are not set.
"""

import os
from typing import Optional

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class ConfigError(Exception):
    """Raised when a required configuration variable is missing."""
    pass


def get_required_env(key: str) -> str:
    """
    Get a required environment variable.
    
    Args:
        key: Environment variable name
        
    Returns:
        Environment variable value
        
    Raises:
        ConfigError: If the variable is not set
    """
    value = os.getenv(key)
    if value is None or value == "":
        raise ConfigError(f"Required environment variable '{key}' is not set")
    return value


def get_optional_env(key: str, default: Optional[str] = None) -> Optional[str]:
    """
    Get an optional environment variable.
    
    Args:
        key: Environment variable name
        default: Default value if not set (default: None)
        
    Returns:
        Environment variable value or default
    """
    return os.getenv(key, default)


# Required configuration variables
AZURE_OPENAI_API_KEY: str = get_required_env("AZURE_OPENAI_API_KEY")
DATABASE_URL: str = get_required_env("DATABASE_URL")

# Optional configuration variables
LANGSMITH_API_KEY: Optional[str] = get_optional_env("LANGSMITH_API_KEY")
LANGSMITH_TRACING: Optional[str] = get_optional_env("LANGSMITH_TRACING")
LANGSMITH_PROJECT: Optional[str] = get_optional_env("LANGSMITH_PROJECT")
LANGSMITH_WORKSPACE_ID: Optional[str] = get_optional_env("LANGSMITH_WORKSPACE_ID")


def is_langsmith_enabled() -> bool:
    """Check if LangSmith tracing is enabled."""
    return LANGSMITH_API_KEY is not None and LANGSMITH_TRACING == "true"

