"""
Scryfall Query Builder Agent.

A specialized agent that converts natural language card descriptions
into valid Scryfall search syntax queries.

Based on: https://scryfall.com/docs/syntax
"""

from langchain.tools import tool
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain.agents import create_agent

from config.config import AZURE_OPENAI_API_KEY
from config.deployments import get_deployment
from prompts import get_prompt


def _create_query_builder_llm() -> AzureChatOpenAI:
    """Create an LLM instance for query building."""
    deployment = get_deployment("gpt-5.1")
    return AzureChatOpenAI(
        azure_deployment=deployment.deployment,
        azure_endpoint=deployment.endpoint,
        api_key=AZURE_OPENAI_API_KEY,
        api_version=deployment.api_version,
        # Note: temperature=0 not supported by all models, using default
    )


# Create the LLM instance
_query_builder_llm = _create_query_builder_llm()

# Load system prompt from file
QUERY_BUILDER_SYSTEM_PROMPT = get_prompt("scryfall_query_builder")


def build_scryfall_query(description: str) -> str:
    """
    Convert a natural language description to a Scryfall search query.
    
    Args:
        description: Natural language description of desired cards
        
    Returns:
        Valid Scryfall search syntax query string
    """
    llm = _create_query_builder_llm()
    
    messages = [
        SystemMessage(content=QUERY_BUILDER_SYSTEM_PROMPT),
        HumanMessage(content=description),
    ]
    
    response = llm.invoke(messages)
    
    # Clean up the response - remove any markdown formatting or extra whitespace
    query = response.content.strip()
    
    # Remove markdown code blocks if present
    if query.startswith("```"):
        lines = query.split("\n")
        query = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    
    # Remove any leading/trailing quotes
    query = query.strip("`'\"")
    
    return query


@tool
def convert_to_scryfall_query(description: str) -> str:
    """
    Convert a natural language description of Magic cards into a valid Scryfall search query.
    
    Use this tool when a user describes cards in plain English and you need to
    search for them using the Scryfall API. The tool understands Scryfall's
    complete search syntax including colors, types, mana costs, formats, and more.
    
    Args:
        description: A natural language description of the cards to search for.
            Examples:
            - "red creatures with 3 power"
            - "blue instant spells that draw cards"
            - "legendary dragons in commander"
            - "cheap removal under 2 mana in modern"
            - "artifacts that cost 0 mana"
            
    Returns:
        A valid Scryfall search syntax query string that can be used with search_cards()
    """
    return build_scryfall_query(description)


# Export the tool
QUERY_BUILDER_TOOLS = [convert_to_scryfall_query]


# =============================================================================
# STANDALONE GRAPH FOR LANGGRAPH DEPLOYMENT
# =============================================================================

from langchain.agents import create_agent

# Create a standalone query builder agent/graph for direct deployment
# Reuse the existing LLM instance
graph = create_agent(
    _query_builder_llm,
    tools=[],  # No tools needed - this agent just converts text
    system_prompt=QUERY_BUILDER_SYSTEM_PROMPT,
)


if __name__ == "__main__":
    # Test the query builder
    test_descriptions = [
        "red creatures with 3 power",
        "blue instant spells that let me draw cards",
        "legendary dragons that are legal in commander",
        "cheap white removal spells under 3 mana",
        "artifacts that tap for mana",
        "planeswalkers from the Innistrad sets",
        "creatures with both flying and deathtouch",
        "lands that enter untapped and produce two colors",
    ]
    
    print("Query Builder Test")
    print("=" * 60)
    
    for desc in test_descriptions:
        print(f"\nDescription: {desc}")
        query = build_scryfall_query(desc)
        print(f"Query: {query}")

