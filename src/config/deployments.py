"""
Deployment configurations for Azure OpenAI models.

This module contains configuration for different Azure OpenAI deployments.
"""

from dataclasses import dataclass


@dataclass
class AzureOpenAIDeployment:
    """Configuration for an Azure OpenAI deployment."""
    endpoint: str
    model_name: str
    deployment: str
    api_version: str


# GPT 5.1 Configuration
GPT_5_1 = AzureOpenAIDeployment(
    endpoint="https://sondereastus2.openai.azure.com/",
    model_name="gpt-5.1",
    deployment="gpt-5.1",
    api_version="2024-12-01-preview",
)

# Text Embedding 3 Large Configuration
TEXT_EMBEDDING_3_LARGE = AzureOpenAIDeployment(
    endpoint="https://sondereastus2.openai.azure.com/",
    model_name="text-embedding-3-large",
    deployment="dev-text-embedding-3-large",
    api_version="2024-02-01",
)

# Dictionary mapping for easy access
DEPLOYMENTS = {
    "gpt-5.1": GPT_5_1,
    "text-embedding-3-large": TEXT_EMBEDDING_3_LARGE,
}


def get_deployment(name: str) -> AzureOpenAIDeployment:
    """
    Get a deployment configuration by name.
    
    Args:
        name: Deployment name (e.g., "gpt-5.1" or "text-embedding-3-large")
        
    Returns:
        AzureOpenAIDeployment configuration
        
    Raises:
        KeyError: If deployment name is not found
    """
    if name not in DEPLOYMENTS:
        available = ", ".join(DEPLOYMENTS.keys())
        raise KeyError(
            f"Deployment '{name}' not found. Available deployments: {available}"
        )
    return DEPLOYMENTS[name]

