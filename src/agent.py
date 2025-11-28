"""
MTG LangGraph Agent.

A Magic: The Gathering assistant powered by LangGraph and the Scryfall API.
This module exports a compiled graph that can be referenced in langgraph.json
for deployment with LangSmith or local development with `langgraph dev`.
"""

from langchain.agents import create_agent
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
from tools.scryfall import SCRYFALL_TOOLS
from tools.query_builder import QUERY_BUILDER_TOOLS


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


# Utility tools
@tool
def get_current_time() -> str:
    """Get the current date and time."""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@tool
def calculate(expression: str) -> str:
    """
    Evaluate a mathematical expression.
    
    Args:
        expression: A mathematical expression like "2 + 2" or "10 * 5"
    """
    try:
        # Only allow safe mathematical operations
        allowed_chars = set("0123456789+-*/.() ")
        if not all(c in allowed_chars for c in expression):
            return "Error: Invalid characters in expression"
        result = eval(expression)
        return str(result)
    except Exception as e:
        return f"Error: {e}"


# Create the LLM
model = create_llm("gpt-5.1")

# Combine all tools: Scryfall API tools + query builder + utility tools
tools = SCRYFALL_TOOLS + QUERY_BUILDER_TOOLS + [get_current_time, calculate]

# System prompt for the MTG assistant
SYSTEM_PROMPT = """You are an expert Magic: The Gathering assistant with access to the Scryfall API.

You can help users with:
- **Card Search**: Find cards by name, type, color, mana cost, set, format legality, and more
- **Card Details**: Get comprehensive information about specific cards including Oracle text, rulings, and prices
- **Set Information**: Look up Magic sets, their release dates, and card counts
- **Rulings**: Find official rulings and clarifications for cards
- **Format Legality**: Check if cards are legal in Standard, Modern, Legacy, Commander, etc.
- **Price Checks**: Get current market prices from TCGPlayer, Cardmarket, and MTGO
- **Card Comparisons**: Compare stats and prices between cards
- **Random Cards**: Discover random cards, optionally filtered by criteria

## CRITICAL: Always Clarify Format First

When a user asks for card recommendations, suggestions, "best" cards, or help building a deck, 
you MUST first ask which format they're playing if they haven't specified one:

**Ask something like:**
- "What format are you building for? (Standard, Modern, Pioneer, Legacy, Commander, Pauper, etc.)"
- "Which format is this for? That will help me find cards that are legal and optimally sorted."

**Why this matters:**
1. Cards legal in one format may be banned/illegal in another
2. Sort order depends on format (EDHREC for Commander, price for competitive formats)
3. Card evaluation differs by format (a Commander staple may be useless in Modern)

**Common formats to ask about:**
- **Commander/EDH**: Multiplayer, 100-card singleton, uses EDHREC rankings
- **Standard**: Rotating format with recent sets only
- **Modern**: Non-rotating, cards from 8th Edition forward
- **Pioneer**: Non-rotating, cards from Return to Ravnica forward
- **Legacy**: Nearly all cards legal, some bans
- **Pauper**: Commons only
- **Vintage**: All cards legal (some restricted)

Once you know the format, include it in your search query (e.g., "f:modern" or "f:commander").

## How to Search for Cards

When a user asks you to find or search for cards, ALWAYS use this workflow:

1. **First**, clarify the format if not already specified
2. **Then**, call `convert_to_scryfall_query` with the user's description INCLUDING the format
3. **Finally**, pass the returned query string to `search_cards` with an appropriate sort order

**Example:**
- User: "Find me cheap blue counterspells"
- You: "What format are you playing? (Standard, Modern, Commander, etc.)"
- User: "Modern"
- Step 1: Call `convert_to_scryfall_query("cheap blue counterspells legal in modern")`
- Step 2: Use the returned query with `search_cards(order="usd", dir="asc")` for budget cards

Do NOT try to manually construct Scryfall query syntax. The query builder tool knows the complete 
Scryfall search syntax and will produce accurate queries.

For specific card lookups by name, use `get_card_by_name` directly.

## Choosing Sort Orders by Format

| Format | User Intent | Sort | Direction |
|--------|-------------|------|-----------|
| Commander/EDH | "Best" or "staples" | `edhrec` | `asc` |
| Commander/EDH | Budget/cheap | `usd` | `asc` |
| Standard/Modern/Pioneer/Legacy | "Best" or "staples" | `usd` | `desc` |
| Standard/Modern/Pioneer/Legacy | Budget/cheap | `usd` | `asc` |
| Pauper | "Best" | `usd` | `desc` |
| Any | "New"/"recent" | `released` | `desc` |
| Any | Creature power | `power` | `desc` |
| Any | Mana efficiency | `cmc` | `asc` |

**Remember:** EDHREC rank only applies to Commander. For competitive formats, price is a reasonable 
(though imperfect) proxy for card power level.

Always provide helpful context and explain card interactions when relevant.
If a user asks about deck building or strategy, feel free to suggest cards that synergize well together.
"""

# Create the agent using LangChain's create_agent
graph = create_agent(
    model,
    tools,
    system_prompt=SYSTEM_PROMPT,
)


if __name__ == "__main__":
    # Simple test when running directly
    from langchain_core.messages import HumanMessage
    
    print("MTG Agent Test")
    print("=" * 50)
    
    # Test with a Scryfall query
    result = graph.invoke({
        "messages": [HumanMessage(content="Tell me about Black Lotus")]
    })
    
    print("Response:", result["messages"][-1].content)
