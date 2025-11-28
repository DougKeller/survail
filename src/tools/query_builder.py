"""
Scryfall Query Builder Agent.

A specialized agent that converts natural language card descriptions
into valid Scryfall search syntax queries.

Based on: https://scryfall.com/docs/syntax
"""

from langchain.tools import tool
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from config.config import AZURE_OPENAI_API_KEY
from config.deployments import get_deployment


# Comprehensive Scryfall syntax reference for the LLM
SCRYFALL_SYNTAX_REFERENCE = """
# Scryfall Search Syntax Reference

## Colors and Color Identity
- `c:` or `color:` - Card color (c:red, c:uw, c:colorless, c:multicolor)
- `id:` or `identity:` - Commander color identity
- Color names: white/w, blue/u, black/b, red/r, green/g, colorless/c
- Guild names: azorius, dimir, rakdos, gruul, selesnya, orzhov, izzet, golgari, boros, simic
- Shard names: bant, esper, grixis, jund, naya
- Wedge names: abzan, jeskai, sultai, mardu, temur
- Comparison: c>=uw (at least white and blue), c<=rg (at most red and green)

## Card Types
- `t:` or `type:` - Any type/supertype/subtype
- Examples: t:creature, t:instant, t:legendary, t:artifact, t:enchantment
- Subtypes: t:elf, t:goblin, t:dragon, t:equipment, t:aura
- Supertypes: t:legendary, t:basic, t:snow

## Card Text (Oracle Text)
- `o:` or `oracle:` - Text in rules box
- Use quotes for phrases: o:"enters the battlefield"
- Use ~ for card's name: o:"~ deals damage"
- `kw:` or `keyword:` - Keyword abilities (kw:flying, kw:trample, kw:deathtouch)

## Mana Costs
- `m:` or `mana:` - Mana cost symbols (m:2WW, m:{G}{U}, m:{W/U})
- `mv:` or `manavalue:` or `cmc:` - Mana value (mv=3, mv<=2, mv>=5)
- `is:hybrid` - Hybrid mana symbols
- `is:phyrexian` - Phyrexian mana symbols

## Power, Toughness, Loyalty
- `pow:` or `power:` - Power (pow>=4, pow=0, pow>tou)
- `tou:` or `toughness:` - Toughness (tou>=5, tou=1)
- `pt:` or `powtou:` - Total P/T (pt>=10)
- `loy:` or `loyalty:` - Starting loyalty (loy=3)

## Rarity
- `r:` or `rarity:` - common, uncommon, rare, mythic, special, bonus
- Comparison: r>=rare (rare or mythic)

## Sets and Blocks
- `e:` or `set:` or `s:` - Set code (e:dom, set:neo, s:mh2)
- `b:` or `block:` - Block name
- `st:` - Set type (st:core, st:expansion, st:masters)

## Format Legality
- `f:` or `format:` - Legal in format
- Formats: standard, pioneer, modern, legacy, vintage, pauper, commander, brawl, historic, alchemy

## Prices
- `usd:` `eur:` `tix:` - Price comparisons (usd<1, usd>=10)

## Multi-faced Cards
- `is:split` - Split cards
- `is:flip` - Flip cards
- `is:transform` - Transform cards
- `is:mdfc` - Modal double-faced cards
- `is:dfc` - Any double-faced card
- `is:meld` - Meld cards

## Card Properties
- `is:commander` - Valid commanders
- `is:spell` - Can be cast as spell
- `is:permanent` - Permanent cards
- `is:historic` - Historic cards
- `is:vanilla` - No rules text
- `is:modal` - Modal effects
- `is:reserved` - Reserved List

## Land Types
- `is:dual` - Dual lands
- `is:fetchland` - Fetch lands
- `is:shockland` - Shock lands
- `is:checkland` - Check lands
- `is:painland` - Pain lands
- `is:triland` - Tri-lands

## Miscellaneous
- `is:funny` - Un-cards and joke cards
- `is:reprint` / `not:reprint` - Reprints
- `is:promo` - Promotional cards
- `is:fullart` - Full art cards
- `is:foil` - Foil printings
- `game:paper` / `game:arena` / `game:mtgo` - Game availability

## Year and Date
- `year:` - Release year (year=2023, year>=2020)
- `date:` - Release date (date>=2023-01-01)

## Tagger Tags (Art and Function)
- `art:` or `atag:` - Art contains (art:fire, art:dragon)
- `function:` or `otag:` - Card function (function:removal, function:ramp)

## Operators
- Comparison: `=`, `!=`, `<`, `>`, `<=`, `>=`
- Negation: `-` prefix (e.g., -t:creature, -c:blue)
- `not:` is same as `-is:` (not:reprint)
- `or` - Alternatives: (t:elf or t:goblin)
- Parentheses for grouping: t:legendary (t:elf or t:goblin)
- Quotes for exact phrases: o:"draw a card"

## Sort and Display (for reference only, not usually in queries)
- `order:` - name, set, cmc, power, rarity, color, usd, edhrec
- `unique:` - cards, prints, art
"""

QUERY_BUILDER_SYSTEM_PROMPT = f"""You are an expert Scryfall search query builder. Your ONLY job is to convert natural language descriptions of Magic: The Gathering cards into valid Scryfall search syntax.

{SCRYFALL_SYNTAX_REFERENCE}

## Your Task
1. Analyze the user's natural language description
2. Identify the key criteria they want to search for
3. Convert those criteria to valid Scryfall syntax
4. Output ONLY the search query - no explanations, no markdown, no extra text

## Rules
- Output ONLY the Scryfall query string, nothing else
- Use the most specific operators available
- Combine multiple criteria with spaces (implicit AND)
- Use `or` for alternatives, with parentheses for grouping
- Use quotes around multi-word phrases in oracle text
- Use `-` to negate conditions
- Keep queries concise but complete

## Examples

User: "red creatures with 3 power"
Output: c:red t:creature pow=3

User: "blue instant spells that draw cards"
Output: c:blue t:instant o:"draw"

User: "legendary creatures that can be commanders in green and white"
Output: t:legendary t:creature id:gw is:commander

User: "cheap removal spells in modern, under 2 mana"
Output: f:modern mv<2 (o:destroy or o:exile or o:damage)

User: "dragons that cost 5 or less mana"
Output: t:dragon mv<=5

User: "planeswalkers from Dominaria"
Output: t:planeswalker e:dom

User: "common artifacts in standard"
Output: r:common t:artifact f:standard

User: "creatures with flying and vigilance"
Output: t:creature kw:flying kw:vigilance

User: "lands that produce any color of mana"
Output: t:land o:"add" o:"any color"

User: "mythic rares worth more than $20"
Output: r:mythic usd>20

User: "cards with the word 'counter' that aren't blue"
Output: o:counter -c:blue

User: "elves or goblins that are legendary"
Output: t:legendary (t:elf or t:goblin)

User: "equipment that gives +2 power"
Output: t:equipment o:"+2/+0" or t:equipment o:"+2/+2"

User: "board wipes in commander"
Output: f:commander o:"destroy all" or f:commander o:"exile all"
"""


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
_query_builder_llm = _create_query_builder_llm()

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

