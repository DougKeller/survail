"""
Statistics Calculator Agent

This module provides an agent that converts natural language questions about
MTG probabilities into statistical tool calls.
"""

from langchain.tools import tool
from langchain_openai import AzureChatOpenAI
from langchain.agents import create_agent

from config.config import AZURE_OPENAI_API_KEY
from config.deployments import get_deployment
from prompts import get_prompt

# Import all statistics tools
from tools.statistics import STATISTICS_TOOLS


def _create_statistics_calculator_llm() -> AzureChatOpenAI:
    """Create an LLM instance for the statistics calculator agent."""
    deployment = get_deployment("gpt-5.1")
    
    return AzureChatOpenAI(
        azure_endpoint=deployment.endpoint,
        api_key=AZURE_OPENAI_API_KEY,
        api_version=deployment.api_version,
        azure_deployment=deployment.deployment,
        model=deployment.model_name,
        temperature=0.0,  # Deterministic for statistical analysis
    )


# Create the LLM instance
_statistics_calculator_llm = _create_statistics_calculator_llm()

# Load system prompt from file
STATISTICS_CALCULATOR_SYSTEM_PROMPT = get_prompt("statistics_calculator")


@tool
def calculate_mtg_probability(question: str) -> str:
    """
    Calculate MTG-related probabilities from a natural language question.
    
    This tool understands questions like:
    - "What are the odds of hitting 1 or more Dragons in the top 8 cards?"
    - "What's the probability of drawing exactly 3 lands in my opening hand?"
    - "By turn 4, what are the odds of having a combo piece?"
    - "On average, how many lands will I draw in my opening 7?"
    
    The tool automatically:
    - Parses the question to identify the right statistical calculation
    - Extracts deck size, card counts, and draw counts
    - Makes reasonable assumptions for missing information
    - Returns a detailed probability analysis
    
    Args:
        question: A natural language question about MTG probabilities
        
    Returns:
        Detailed statistical analysis with percentages and odds ratios.
        
    Example:
        calculate_mtg_probability("What are the odds of drawing at least 2 lands in my opening 7 if I run 24 lands?")
    """
    # Create a standalone graph for the statistics calculator
    # It has access to all statistics tools
    graph = create_agent(
        _statistics_calculator_llm,
        tools=STATISTICS_TOOLS,
        system_prompt=STATISTICS_CALCULATOR_SYSTEM_PROMPT,
    )
    
    # Invoke the agent with the question
    result = graph.invoke({"messages": [("user", question)]})
    
    # Extract the final response
    messages = result.get("messages", [])
    if messages:
        return messages[-1].content
    
    return "Unable to calculate probability. Please rephrase your question."


# Create a standalone statistics calculator agent/graph for direct deployment
graph = create_agent(
    _statistics_calculator_llm,
    tools=STATISTICS_TOOLS,
    system_prompt=STATISTICS_CALCULATOR_SYSTEM_PROMPT,
)

# Export the tool for use by the main agent
STATISTICS_CALCULATOR_TOOLS = [calculate_mtg_probability]


if __name__ == "__main__":
    # Simple test
    test_questions = [
        "What are the odds of hitting 1 or more Dragons off the top 8 cards if I have 12 dragons in my 60-card deck?",
        "In my Commander deck with 35 lands, what's the probability of drawing exactly 3 in my opening hand?",
        "What are the odds of drawing both combo pieces (4 of each) in my opening 7?",
    ]
    
    print("=== Statistics Calculator Agent Test ===\n")
    
    for question in test_questions:
        print(f"Q: {question}\n")
        result = calculate_mtg_probability.invoke({"question": question})
        print(f"A: {result}\n")
        print("-" * 80 + "\n")

