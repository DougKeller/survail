"""
MTG Deep Agent.

A Magic: The Gathering assistant powered by Deep Agents and the Scryfall API.
This agent has planning capabilities, filesystem for context management,
and can spawn subagents for complex tasks.

This module exports a compiled graph that can be referenced in langgraph.json
for deployment with LangSmith or local development with `langgraph dev`.
"""

from deepagents import create_deep_agent
from langchain.tools import tool
from langchain_openai import AzureChatOpenAI

from config.config import ConfigError

try:
    from config.config import AZURE_OPENAI_API_KEY
    from config.deployments import get_deployment
except ConfigError as e:
    raise RuntimeError(
        f"Configuration Error: {e}\n"
        "Please set all required environment variables in your .env file:\n"
        "  - AZURE_OPENAI_API_KEY"
    ) from e

# Import tools
from tools.scryfall import (
    SCRYFALL_TOOLS,
    get_card_by_name,
    get_rulings_by_card_name,
    get_random_card,
    search_cards,
    compare_cards,
)
from tools.query_builder import QUERY_BUILDER_TOOLS
from tools.statistics_calculator import STATISTICS_CALCULATOR_TOOLS

# Import prompt loader
from prompts import get_prompt


def create_llm(deployment_name: str = "gpt-5.1") -> AzureChatOpenAI:
    """
    Create and configure Azure OpenAI LLM using deployment configuration.
    
    Args:
        deployment_name: Name of the deployment to use (default: "gpt-5.1")
        
    Returns:
        Configured AzureChatOpenAI instance
    """
    deployment = get_deployment(deployment_name)
    
    return AzureChatOpenAI(
        azure_deployment=deployment.deployment,
        azure_endpoint=deployment.endpoint,
        api_key=AZURE_OPENAI_API_KEY,
        api_version=deployment.api_version,
    )

# Create the LLM
model = create_llm("gpt-5.1")

# Combine all tools: Scryfall API tools + query builder + statistics calculator
tools = SCRYFALL_TOOLS + QUERY_BUILDER_TOOLS + STATISTICS_CALCULATOR_TOOLS

# Load system prompts from files
SYSTEM_PROMPT = get_prompt("scryfall_assistant")

# Define specialized MTG subagents
mtg_subagents = [
    {
        "name": "research_specialist",
        "description": "Deep research specialist for MTG cards, strategies, and meta analysis. Delegate complex research tasks that require thorough investigation of multiple card options or strategic approaches.",
        "system_prompt": get_prompt("scryfall_assistant_research_specialist"),
        "tools": tools,  # Same tools as main agent
        "model": model,
    },
    {
        "name": "combo_evaluator",
        "description": "Evaluates card interactions, synergies, and anti-synergies (nonbos). Use this agent to analyze whether cards work well together, identify combo potential, or spot problematic interactions.",
        "system_prompt": get_prompt("scryfall_assistant_combo_evaluator"),
        "tools": tools,  # Same tools as main agent
        "model": model,
    },
    {
        "name": "brainstorming",
        "description": "Creative brainstorming agent for deck ideas, unique strategies, and alternative approaches. Use when you need fresh perspectives, unconventional strategies, or to explore 'outside the box' deck building ideas.",
        "system_prompt": get_prompt("scryfall_assistant_brainstorming"),
        "tools": tools,  # Same tools as main agent
        "model": model,
    },
    {
        "name": "price_analyst",
        "description": "Budget optimization and price comparison specialist. Delegate detailed price analysis, budget deck building, or finding budget alternatives to expensive cards.",
        "system_prompt": get_prompt("scryfall_assistant_price_analyst"),
        "tools": tools,  # Same tools as main agent
        "model": model,
    }
]

# Create the deep agent - middleware is automatically added
# We pass backend, store, and subagents as parameters
graph = create_deep_agent(
    model=model,
    tools=tools,
    system_prompt=SYSTEM_PROMPT,
    subagents=mtg_subagents,
)


if __name__ == "__main__":
    # Simple test when running directly
    from langchain_core.messages import HumanMessage
    
    print("MTG Deep Agent Test")
    print("=" * 50)
    
    # Test with a Scryfall query
    result = graph.invoke({
        "messages": [HumanMessage(content="Tell me about Black Lotus")]
    })
    
    print("Response:", result["messages"][-1].content)
