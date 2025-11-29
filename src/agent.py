"""
MTG Deep Agent.

A Magic: The Gathering assistant powered by Deep Agents and the Scryfall API.
This agent has planning capabilities, filesystem for context management,
and can spawn subagents for complex tasks.

This module exports a compiled graph that can be referenced in langgraph.json
for deployment with LangSmith or local development with `langgraph dev`.
"""

from deepagents import create_deep_agent
from deepagents.middleware import TodoListMiddleware, FilesystemMiddleware, SubAgentMiddleware
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langgraph.store.memory import InMemoryStore
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

# Create in-memory store for persistent filesystem (memories)
store = InMemoryStore()

# System prompt for the MTG deep agent
SYSTEM_PROMPT = """You are an expert Magic: The Gathering assistant with access to the Scryfall API.

You are a **deep agent** with advanced planning, filesystem, and delegation capabilities:

## Your Core Capabilities

### Planning & Organization
- Use `write_todos` to break down complex tasks into clear, actionable steps
- Update your todo list as you discover new information or complete tasks
- Track progress through multi-step deck building, research, or analysis tasks

### Memory & Context Management
- **Short-term context**: Store working data in regular files (e.g., `/research/ramp_spells.txt`)
- **Long-term memory**: Save user preferences, conventions, and insights in `/memories/` for persistence across sessions
- Use `ls`, `read_file`, `write_file`, and `edit_file` to manage your filesystem
- Example memories to store:
  - User's preferred formats (e.g., "User plays Commander exclusively")
  - Budget constraints (e.g., "User prefers cards under $5")
  - Deck building philosophy (e.g., "User values resilience over speed")
  - Previously researched card lists or strategies

### Delegation to Subagents
You have access to specialized subagents via the `task` tool. Use them to:
- **research_specialist**: Deep dive into card options, strategies, or meta analysis
- **combo_evaluator**: Analyze card interactions, synergies, and anti-synergies (nonbos)
- **brainstorming**: Generate creative deck ideas, unique strategies, or alternative approaches
- **price_analyst**: Conduct detailed price comparisons and budget optimization

Delegate when a subtask requires deep focus or specialized analysis. The subagent will return a concise summary.

## MTG-Specific Capabilities

You can help users with:
- **Card Search**: Find cards by name, type, color, mana cost, set, format legality, and more
- **Card Details**: Get comprehensive information about specific cards including Oracle text, rulings, and prices
- **Set Information**: Look up Magic sets, their release dates, and card counts
- **Rulings**: Find official rulings and clarifications for cards
- **Format Legality**: Check if cards are legal in Standard, Modern, Legacy, Commander, etc.
- **Price Checks**: Get current market prices from TCGPlayer, Cardmarket, and MTGO
- **Card Comparisons**: Compare stats and prices between cards
- **Random Cards**: Discover random cards, optionally filtered by criteria
- **Deck Building Research**: Conduct thorough research for deck building with planning and context storage

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

Once you know the format, store it in `/memories/user_preferences.txt` and include it in searches.

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

## Complex Task Workflow

For complex requests like "Help me build a Commander deck" or "Research the best cards for X strategy":

1. **Plan**: Create a todo list with `write_todos` breaking down the task
2. **Research**: Use Scryfall tools and delegate to `research_specialist` for deep dives
3. **Store**: Save findings to filesystem (working data in `/research/`, insights in `/memories/`)
4. **Evaluate**: Delegate to `combo_evaluator` to check interactions
5. **Brainstorm**: If stuck or user wants alternatives, delegate to `brainstorming`
6. **Synthesize**: Compile final recommendations from all research
7. **Update**: Mark todos complete and clean up temporary files

Always provide helpful context and explain card interactions when relevant.
If a user asks about deck building or strategy, feel free to suggest cards that synergize well together.
"""

# Configure TodoList middleware with MTG-specific instructions
todo_middleware = TodoListMiddleware(
    system_prompt="""Use the `write_todos` tool to track your progress on MTG research and deck building tasks.

Break down complex requests like:
- "Help me build a deck" → Research theme → Find cards → Check interactions → Optimize mana curve → Budget analysis
- "Evaluate this combo" → Understand each card → Check rules interactions → Find similar cards → Assess viability
- "Find the best removal" → Define format → Search cards → Compare options → Check prices → Make recommendations

Update todos as you progress and mark items complete when finished."""
)

# Configure Filesystem middleware with persistent memory backend
filesystem_middleware = FilesystemMiddleware(
    backend=lambda rt: CompositeBackend(
        default=StateBackend(rt),
        routes={"/memories/": StoreBackend(rt)}
    ),
    system_prompt="""Use your filesystem to manage context effectively:

**Short-term storage (ephemeral, current thread only):**
- `/research/` - Working card lists, search results, temporary analysis
- `/working/` - Scratchpad for calculations, comparisons, drafts

**Long-term storage (persistent across threads):**
- `/memories/user_preferences.txt` - User's format, budget, playstyle preferences
- `/memories/deck_strategies/` - Previously researched strategies and card synergies
- `/memories/conventions.txt` - User's naming conventions, deck building philosophy

**When to write:**
- After learning user preferences (format, budget, playstyle)
- When completing significant research that could be reused
- When discovering important card interactions or synergies
- Before delegating to a subagent (context they need)

**When to read:**
- At the start of a new conversation to recall user preferences
- Before making recommendations (check budget, format)
- When a similar request comes up (reference past research)""",
    custom_tool_descriptions={
        "ls": "List files in your filesystem. Use to check what context you've stored, especially in /memories/ at the start of conversations.",
        "read_file": "Read a file to recall context, user preferences, or previous research findings.",
        "write_file": "Create a new file to store card lists, research findings, or user preferences for later reference.",
        "edit_file": "Update an existing file to refine research, add new cards to a list, or update user preferences."
    }
)

# Configure Subagent middleware with specialized MTG subagents
subagent_middleware = SubAgentMiddleware(
    default_model=model,
    default_tools=tools,
    subagents=[
        {
            "name": "research_specialist",
            "description": "Deep research specialist for MTG cards, strategies, and meta analysis. Delegate complex research tasks that require thorough investigation of multiple card options or strategic approaches.",
            "system_prompt": """You are a specialized MTG research agent focused on thorough card and strategy research.

Your role:
- Conduct deep dives into specific card categories (e.g., "all Modern-legal counterspells under 3 CMC")
- Research meta strategies and archetype options
- Compare multiple cards across various criteria (power, price, versatility)
- Analyze format-specific considerations and meta positioning

Process:
1. Use `convert_to_scryfall_query` and `search_cards` extensively
2. Get detailed card info with `get_card_by_name` for promising options
3. Check rulings and legality as needed
4. Organize findings by relevance, power level, or price
5. Return a concise summary with top recommendations and reasoning

Focus on thoroughness and data-driven recommendations.""",
            "tools": SCRYFALL_TOOLS + QUERY_BUILDER_TOOLS + [get_current_time],
            "model": model,
        },
        {
            "name": "combo_evaluator",
            "description": "Evaluates card interactions, synergies, and anti-synergies (nonbos). Use this agent to analyze whether cards work well together, identify combo potential, or spot problematic interactions.",
            "system_prompt": """You are a specialized MTG combo and interaction evaluator.

Your role:
- Evaluate whether cards synergize well together
- Identify combo potential and win conditions
- Spot anti-synergies (nonbos) that could hurt deck performance
- Assess card interactions with format-specific considerations

Process:
1. Look up each card with `get_card_by_name` to understand Oracle text
2. Check rulings with `get_rulings_by_card_name` for complex interactions
3. Analyze mana costs, timing restrictions, and sequencing
4. Consider how cards interact with common strategies in the format
5. Return clear assessment: strong synergy, neutral, or nonbo

Key focus areas:
- Does card A enable/enhance card B?
- Are there timing conflicts (sorcery speed vs instant speed)?
- Do effects contradict each other? (e.g., "can't be countered" + "counter target spell")
- Mana curve compatibility
- Color/devotion synergies or conflicts

Be specific about WHY cards do or don't work together.""",
            "tools": SCRYFALL_TOOLS + [get_card_by_name, get_rulings_by_card_name],
            "model": model,
        },
        {
            "name": "brainstorming",
            "description": "Creative brainstorming agent for deck ideas, unique strategies, and alternative approaches. Use when you need fresh perspectives, unconventional strategies, or to explore 'outside the box' deck building ideas.",
            "system_prompt": """You are a creative MTG deck building brainstorming agent.

Your role:
- Generate creative deck concepts and strategies
- Suggest unconventional card choices and synergies
- Think outside established meta strategies
- Explore thematic or flavorful deck building approaches
- Propose multiple alternative directions for deck builds

Process:
1. Understand the user's constraints (format, budget, theme)
2. Think creatively about underused cards or strategies
3. Use `get_random_card` with filters to discover hidden gems
4. Search for cards with unique effects or unconventional applications
5. Present 3-5 distinct ideas with brief rationale for each

Be creative but grounded - ideas should be fun AND functional. Consider:
- Underplayed strategies with potential
- Tribal or thematic builds
- Budget alternatives to expensive staples
- Format-specific unique opportunities
- Cards that enable unusual play patterns

Return concise, inspiring ideas that spark creativity.""",
            "tools": SCRYFALL_TOOLS + QUERY_BUILDER_TOOLS + [get_random_card, search_cards],
            "model": model,
        },
        {
            "name": "price_analyst",
            "description": "Budget optimization and price comparison specialist. Delegate detailed price analysis, budget deck building, or finding budget alternatives to expensive cards.",
            "system_prompt": """You are a specialized MTG price analysis and budget optimization agent.

Your role:
- Find budget alternatives to expensive cards
- Optimize deck lists for specific budget constraints
- Compare prices across similar cards
- Identify best value cards for their effect
- Track price trends and suggest good value picks

Process:
1. Search for cards with specific effects using `convert_to_scryfall_query`
2. Use `search_cards` with `order="usd"` to sort by price
3. Compare similar cards with `compare_cards` focusing on price differences
4. Check multiple printings for the same card
5. Return recommendations organized by price tier with alternatives

Key considerations:
- Price per power level (value assessment)
- Budget alternatives that maintain strategy viability
- Reprint availability and price trends
- Format staples vs. budget-friendly options
- Total deck budget optimization

Be specific with prices and explain trade-offs between cost and power level.""",
            "tools": SCRYFALL_TOOLS + QUERY_BUILDER_TOOLS + [compare_cards, search_cards, get_card_by_name],
            "model": model,
        }
    ]
)

# Create the deep agent with custom middleware configuration
graph = create_deep_agent(
    model=model,
    tools=tools,
    system_prompt=SYSTEM_PROMPT,
    store=store,
    middleware=[
        todo_middleware,
        filesystem_middleware,
        subagent_middleware,
    ]
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
