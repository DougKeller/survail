# Persistent Artifact Storage Strategy

**Date**: November 29, 2025  
**Status**: Architecture Recommendation

---

## Question

How should we persist deck-building artifacts (North Star visions, evaluation rubrics, deck lists, card scores) so they're deterministically retrievable across threads and sessions?

**Options Considered**:
1. Graph State (checkpointed)
2. LangGraph Store (cross-thread persistence)
3. Tool-based filesystem access
4. Middleware for context injection
5. Custom external database

---

## Recommendation: LangGraph Store + Tools

**Use LangGraph Store for artifact persistence, accessed via dedicated tools.**

### Why This Approach?

| Requirement | LangGraph Store | Graph State | Middleware | Tools Only |
|-------------|----------------|-------------|------------|------------|
| **Cross-thread access** | ✅ Yes | ❌ Thread-scoped | ⚠️ Per-request | ❌ No memory |
| **Persistent storage** | ✅ Postgres/Redis | ✅ Checkpointed | ❌ Transient | ⚠️ Manual |
| **Structured queries** | ✅ Namespace + filters | ❌ Blob retrieval | ❌ N/A | ⚠️ Manual |
| **Agent-accessible** | ✅ Via tools | ✅ Via state | ✅ Auto-injected | ✅ Explicit |
| **User-scoped** | ✅ Namespace | ❌ Thread-only | ⚠️ Config | ⚠️ Manual |
| **Deterministic retrieval** | ✅ Key-based | ✅ State key | ❌ Per-invoke | ⚠️ Path-based |

---

## Architecture

### 1. Storage Layer: LangGraph Store

**What is it?**
- LangGraph's built-in cross-thread persistence system
- Stores JSON documents with namespaces (like folders) and keys (like filenames)
- Supports `put()`, `get()`, `search()`, `delete()`
- Backs onto Postgres, Redis, or in-memory for dev

**Key Concepts**:
```python
# Namespace: Hierarchical organization
namespace = ("user_123", "deck_visions")  # ("user_id", "artifact_type")

# Key: Unique identifier within namespace
key = "atraxa_superfriends"

# Value: Any JSON-serializable data
value = {
    "primary_wincon": "Planeswalker ultimates",
    "game_plan": {...},
    "created_at": "2025-11-29T12:00:00Z"
}

# Store operation
store.put(namespace, key, value)

# Retrieve operation
item = store.get(namespace, key)  # Returns Item with .value, .key, .namespace, .created_at, etc.

# Search operation
items = store.search(
    namespace=("user_123", "deck_visions"),
    filter={"format": "commander"},
    query="superfriends"  # Vector similarity if embeddings configured
)
```

### 2. Access Layer: Dedicated Tools

**Why tools?**
- **Explicit control**: Agent decides when to load/save artifacts
- **Observable**: Tool calls visible in traces
- **Typed**: Strong schemas for each artifact type
- **Reusable**: Same tools across main agent and subagents
- **Testable**: Can mock store in tests

**Tool Architecture**:
```
Artifact Management Tools
│
├── North Star Tools
│   ├── create_deck_vision()
│   ├── get_deck_vision()
│   ├── update_deck_vision()
│   └── list_deck_visions()
│
├── Rubric Tools
│   ├── generate_deck_rubric()
│   ├── get_deck_rubric()
│   └── update_deck_rubric()
│
├── Deck List Tools
│   ├── create_deck()
│   ├── add_card_to_deck()
│   ├── remove_card_from_deck()
│   ├── get_deck()
│   ├── list_decks()
│   └── validate_deck()
│
└── Card Evaluation Tools
    ├── evaluate_card_for_deck()
    ├── batch_evaluate_cards()
    ├── get_card_evaluation()
    └── rank_deck_cards()
```

---

## Implementation

### Step 1: Configure Store

**Development** (already configured via `deepagents`):
```python
# src/agent.py (already exists)
from langgraph.store.memory import InMemoryStore
from deepagents import create_deep_agent

# Agent already has StoreBackend for /memories/
# But we need store access for our tools
```

**Production** (use Postgres):
```python
# src/agent.py (update)
from langgraph.store.postgres import PostgresStore
from config.config import DATABASE_URL

store = PostgresStore(connection_string=DATABASE_URL)

graph = create_deep_agent(
    model=model,
    tools=tools,
    system_prompt=SYSTEM_PROMPT,
    subagents=mtg_subagents,
    store=store,  # Pass store to agent
)
```

### Step 2: Define Namespace Structure

```python
# src/tools/deck_manager.py

from typing import Tuple

def get_namespace(user_id: str, artifact_type: str) -> Tuple[str, str]:
    """
    Generate namespace for artifact storage.
    
    Namespace structure: (user_id, artifact_type)
    
    Artifact types:
    - "deck_visions": North Star documents
    - "deck_rubrics": Evaluation rubrics
    - "deck_lists": Full deck state (cards, scores, metadata)
    - "card_evaluations": Individual card scores (cache)
    
    Args:
        user_id: User identifier (e.g., "user_123" or "guest_session_abc")
        artifact_type: Type of artifact to store
        
    Returns:
        Tuple of (user_id, artifact_type) for use as namespace
    """
    return (user_id, artifact_type)


# Example namespaces:
# ("user_123", "deck_visions") → All North Stars for user_123
# ("user_123", "deck_lists") → All decks for user_123
# ("user_123", "card_evaluations") → Cached evaluations for user_123
```

### Step 3: Implement Artifact Tools

**Example: North Star Vision Tools**

```python
# src/tools/deck_manager.py

from langchain.tools import tool, ToolRuntime
from typing import Dict, Any, List, Optional
import json
from datetime import datetime

@tool
def create_deck_vision(
    deck_name: str,
    primary_wincon: str,
    early_game_plan: str,
    mid_game_plan: str,
    late_game_plan: str,
    backup_plans: List[str],
    strategic_pillars: List[str],
    format: str,
    runtime: ToolRuntime,
) -> str:
    """
    Create and save a North Star vision for a deck.
    
    This establishes the strategic blueprint that guides all card selection
    and evaluation for this deck.
    
    Args:
        deck_name: Name of the deck (e.g., "Atraxa Superfriends")
        primary_wincon: Main way the deck wins
        early_game_plan: Strategy for turns 1-3
        mid_game_plan: Strategy for turns 4-6
        late_game_plan: Strategy for turns 7+
        backup_plans: Alternative strategies if primary fails
        strategic_pillars: Core themes (e.g., ["Card Advantage", "Ramp"])
        format: Magic format (e.g., "commander", "modern")
        runtime: Tool runtime for accessing store
        
    Returns:
        Confirmation message with deck vision ID
    """
    store = runtime.store
    user_id = runtime.context.get("user_id", "guest")
    
    # Sanitize deck name for use as key
    deck_id = deck_name.lower().replace(" ", "_").replace(",", "")
    
    # Create vision document
    vision = {
        "deck_name": deck_name,
        "deck_id": deck_id,
        "format": format,
        "primary_wincon": primary_wincon,
        "game_plan": {
            "early": early_game_plan,
            "mid": mid_game_plan,
            "late": late_game_plan,
        },
        "backup_plans": backup_plans,
        "strategic_pillars": strategic_pillars,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    # Store in namespace
    namespace = get_namespace(user_id, "deck_visions")
    store.put(namespace, deck_id, vision)
    
    return f"""
✅ Deck Vision Created: {deck_name}

**Deck ID**: {deck_id}
**Format**: {format}
**Primary Win Condition**: {primary_wincon}

The North Star vision has been saved and will guide all card selection
and evaluation for this deck.

To retrieve this vision later, use: `get_deck_vision("{deck_id}")`
"""


@tool
def get_deck_vision(
    deck_id: str,
    runtime: ToolRuntime,
) -> str:
    """
    Retrieve a saved North Star vision for a deck.
    
    Args:
        deck_id: Unique identifier for the deck (sanitized deck name)
        runtime: Tool runtime for accessing store
        
    Returns:
        The full North Star vision document as formatted text
    """
    store = runtime.store
    user_id = runtime.context.get("user_id", "guest")
    
    namespace = get_namespace(user_id, "deck_visions")
    item = store.get(namespace, deck_id)
    
    if not item:
        available = list_deck_visions.invoke({"runtime": runtime})
        return f"""
❌ Deck Vision Not Found: {deck_id}

No North Star vision exists for deck "{deck_id}".

{available}

To create a vision, use: `create_deck_vision(...)`
"""
    
    vision = item.value
    
    return f"""
# Deck Vision: {vision['deck_name']}

**Format**: {vision['format']}
**Deck ID**: {vision['deck_id']}

## Primary Win Condition
{vision['primary_wincon']}

## Game Plan

### Early Game (Turns 1-3)
{vision['game_plan']['early']}

### Mid Game (Turns 4-6)
{vision['game_plan']['mid']}

### Late Game (Turns 7+)
{vision['game_plan']['late']}

## Backup Plans
{chr(10).join(f"- {plan}" for plan in vision['backup_plans'])}

## Strategic Pillars
{chr(10).join(f"- {pillar}" for pillar in vision['strategic_pillars'])}

---
*Created: {vision['created_at']}*
*Last Updated: {vision['updated_at']}*
"""


@tool
def list_deck_visions(
    runtime: ToolRuntime,
) -> str:
    """
    List all saved deck visions for the current user.
    
    Args:
        runtime: Tool runtime for accessing store
        
    Returns:
        List of deck names and IDs
    """
    store = runtime.store
    user_id = runtime.context.get("user_id", "guest")
    
    namespace = get_namespace(user_id, "deck_visions")
    items = store.search(namespace, limit=100)
    
    if not items:
        return """
📋 No Deck Visions Found

You haven't created any North Star visions yet.

To create one, use: `create_deck_vision(...)`
"""
    
    result = f"📋 Your Deck Visions ({len(items)} total)\n\n"
    for item in items:
        vision = item.value
        result += f"- **{vision['deck_name']}** (`{vision['deck_id']}`)\n"
        result += f"  Format: {vision['format']}\n"
        result += f"  Primary Wincon: {vision['primary_wincon']}\n\n"
    
    return result


@tool
def update_deck_vision(
    deck_id: str,
    updates: Dict[str, Any],
    runtime: ToolRuntime,
) -> str:
    """
    Update an existing deck vision.
    
    Args:
        deck_id: Deck identifier
        updates: Dict of fields to update (e.g., {"primary_wincon": "..."})
        runtime: Tool runtime for accessing store
        
    Returns:
        Confirmation message
    """
    store = runtime.store
    user_id = runtime.context.get("user_id", "guest")
    
    namespace = get_namespace(user_id, "deck_visions")
    item = store.get(namespace, deck_id)
    
    if not item:
        return f"❌ Deck vision '{deck_id}' not found."
    
    vision = item.value
    vision.update(updates)
    vision["updated_at"] = datetime.utcnow().isoformat()
    
    store.put(namespace, deck_id, vision)
    
    return f"✅ Deck vision '{deck_id}' updated successfully."
```

**Example: Deck List Tools**

```python
# src/tools/deck_manager.py (continued)

@tool
def create_deck(
    deck_name: str,
    format: str,
    commander: Optional[str],
    deck_vision_id: str,
    runtime: ToolRuntime,
) -> str:
    """
    Create a new deck with empty card list.
    
    This initializes the deck state. Cards are added later via add_card_to_deck().
    
    Args:
        deck_name: Name of the deck
        format: Magic format (commander, modern, standard, etc.)
        commander: Commander card name (required for Commander format)
        deck_vision_id: ID of the North Star vision guiding this deck
        runtime: Tool runtime for accessing store
        
    Returns:
        Confirmation with deck ID
    """
    store = runtime.store
    user_id = runtime.context.get("user_id", "guest")
    
    deck_id = deck_name.lower().replace(" ", "_").replace(",", "")
    
    # Verify vision exists
    vision_namespace = get_namespace(user_id, "deck_visions")
    vision_item = store.get(vision_namespace, deck_vision_id)
    if not vision_item:
        return f"❌ Deck vision '{deck_vision_id}' not found. Create a North Star first."
    
    # Verify commander requirement
    if format.lower() == "commander" and not commander:
        return "❌ Commander format requires a commander card."
    
    # Create deck document
    deck = {
        "deck_name": deck_name,
        "deck_id": deck_id,
        "format": format,
        "commander": commander,
        "deck_vision_id": deck_vision_id,
        "cards": [],  # List of card objects
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "validation": {
            "is_legal": None,  # Not yet validated
            "errors": [],
            "warnings": [],
        },
        "statistics": {
            "total_cards": 1 if commander else 0,
            "avg_cmc": 0.0,
            "color_distribution": {},
            "type_counts": {},
        },
    }
    
    namespace = get_namespace(user_id, "deck_lists")
    store.put(namespace, deck_id, deck)
    
    return f"""
✅ Deck Created: {deck_name}

**Deck ID**: {deck_id}
**Format**: {format}
**Commander**: {commander or "N/A"}
**North Star**: {deck_vision_id}

Current cards: {1 if commander else 0}

To add cards, use: `add_card_to_deck("{deck_id}", "Card Name", ...)`
"""


@tool
def add_card_to_deck(
    deck_id: str,
    card_name: str,
    quantity: int,
    category: str,
    rationale: str,
    runtime: ToolRuntime,
) -> str:
    """
    Add a card to a deck with metadata.
    
    This MUST be called after evaluating the card with evaluate_card_for_deck().
    
    Args:
        deck_id: Deck identifier
        card_name: Name of the card to add
        quantity: Number of copies (1 for Commander, 1-4 for others)
        category: Card category (e.g., "ramp", "removal", "wincon")
        rationale: Why this card fits the deck's strategy
        runtime: Tool runtime for accessing store
        
    Returns:
        Confirmation with updated deck count
    """
    from tools.scryfall import get_card_by_name
    
    store = runtime.store
    user_id = runtime.context.get("user_id", "guest")
    
    # Load deck
    namespace = get_namespace(user_id, "deck_lists")
    item = store.get(namespace, deck_id)
    if not item:
        return f"❌ Deck '{deck_id}' not found."
    
    deck = item.value
    
    # Verify card exists (ENFORCED VERIFICATION)
    card_data_str = get_card_by_name.invoke({"name": card_name})
    if "not found" in card_data_str.lower():
        return f"❌ Card '{card_name}' not found. Please verify the name."
    
    # TODO: Parse card data from string (or refactor get_card_by_name to return dict)
    # For now, assume card_name is valid
    
    # Check for duplicates (Commander singleton rule)
    if deck["format"].lower() == "commander":
        existing = [c for c in deck["cards"] if c["name"].lower() == card_name.lower()]
        if existing and card_name.lower() != deck.get("commander", "").lower():
            return f"❌ Singleton violation: '{card_name}' is already in the deck."
    
    # Check quantity limits
    if deck["format"].lower() != "commander" and quantity > 4:
        return f"❌ Maximum 4 copies of '{card_name}' allowed (except basic lands)."
    
    # Add card to deck
    card_entry = {
        "name": card_name,
        "quantity": quantity,
        "category": category,
        "rationale": rationale,
        "added_at": datetime.utcnow().isoformat(),
        # Evaluation data will be added by evaluate_card_for_deck()
    }
    
    deck["cards"].append(card_entry)
    deck["updated_at"] = datetime.utcnow().isoformat()
    
    # Update statistics
    deck["statistics"]["total_cards"] = sum(c["quantity"] for c in deck["cards"])
    if deck.get("commander"):
        deck["statistics"]["total_cards"] += 1
    
    # Save updated deck
    store.put(namespace, deck_id, deck)
    
    return f"""
✅ Added to {deck["deck_name"]}: {card_name} (x{quantity})

**Category**: {category}
**Rationale**: {rationale}

Current deck size: {deck["statistics"]["total_cards"]} cards

To evaluate this card's score, use: `evaluate_card_for_deck("{deck_id}", "{card_name}")`
"""


@tool
def get_deck(
    deck_id: str,
    include_oracle_text: bool,
    runtime: ToolRuntime,
) -> str:
    """
    Retrieve full deck list with all card details.
    
    This provides the complete deck context needed for synergy evaluation.
    
    Args:
        deck_id: Deck identifier
        include_oracle_text: If True, includes Oracle text for all cards
        runtime: Tool runtime for accessing store
        
    Returns:
        Full deck list with metadata
    """
    store = runtime.store
    user_id = runtime.context.get("user_id", "guest")
    
    namespace = get_namespace(user_id, "deck_lists")
    item = store.get(namespace, deck_id)
    
    if not item:
        return f"❌ Deck '{deck_id}' not found."
    
    deck = item.value
    
    result = f"""
# Deck: {deck['deck_name']}

**Format**: {deck['format']}
**Commander**: {deck.get('commander', 'N/A')}
**North Star**: {deck['deck_vision_id']}
**Total Cards**: {deck['statistics']['total_cards']}

## Card List

"""
    
    for card in deck["cards"]:
        result += f"**{card['name']}** (x{card['quantity']})\n"
        result += f"  Category: {card['category']}\n"
        result += f"  Rationale: {card['rationale']}\n"
        
        if card.get("score"):
            result += f"  Score: {card['score']}/100\n"
        
        if include_oracle_text:
            # Fetch Oracle text from Scryfall (cached)
            from tools.scryfall import get_card_by_name
            card_data = get_card_by_name.invoke({"name": card["name"]})
            result += f"  Oracle Text: {card_data}\n"
        
        result += "\n"
    
    return result
```

### Step 4: Update Agent to Use Store

```python
# src/agent.py (update)

from langgraph.store.postgres import PostgresStore
from config.config import DATABASE_URL

# Import new deck management tools
from tools.deck_manager import (
    create_deck_vision,
    get_deck_vision,
    list_deck_visions,
    update_deck_vision,
    create_deck,
    add_card_to_deck,
    get_deck,
    # ... other deck tools
)

# Create PostgresStore
store = PostgresStore(connection_string=DATABASE_URL)

# Add deck management tools to toolset
tools = (
    SCRYFALL_TOOLS +
    QUERY_BUILDER_TOOLS +
    STATISTICS_CALCULATOR_TOOLS +
    [
        create_deck_vision,
        get_deck_vision,
        list_deck_visions,
        update_deck_vision,
        create_deck,
        add_card_to_deck,
        get_deck,
        # ... other deck tools
    ]
)

# Create agent with store
graph = create_deep_agent(
    model=model,
    tools=tools,
    system_prompt=SYSTEM_PROMPT,
    subagents=mtg_subagents,
    store=store,  # Pass store for tool access
)
```

### Step 5: Update System Prompt

```python
# src/prompts/scryfall_assistant.txt (add section)

## Deck Building Workflow

When helping users build decks, follow this structured workflow:

1. **Create North Star**: Use `create_deck_vision()` to establish strategic goals
2. **Create Deck**: Use `create_deck()` to initialize deck with vision reference
3. **Load Context**: Use `get_deck_vision()` and `get_deck()` before evaluating cards
4. **Add Cards**: Use `add_card_to_deck()` after evaluation
5. **Validate**: Use `validate_deck()` to check format legality

**CRITICAL**: Always load the North Star vision before making card recommendations.
Never assume you remember the vision from earlier in the conversation.
```

---

## User Context: Identifying Users

**Problem**: How do we know which user's artifacts to retrieve?

**Solution**: Use runtime context

```python
# When invoking the agent
from langchain_core.messages import HumanMessage

result = graph.invoke(
    {
        "messages": [HumanMessage(content="Show me my decks")],
    },
    config={
        "context": {
            "user_id": "user_123",  # From auth system
        }
    }
)
```

**In tools**:
```python
@tool
def get_deck_vision(deck_id: str, runtime: ToolRuntime) -> str:
    user_id = runtime.context.get("user_id", "guest")
    namespace = (user_id, "deck_visions")
    # ...
```

---

## Benefits of This Approach

### 1. **Cross-Thread Persistence**
- North Stars survive across different conversations
- User can start a deck in one session, continue in another
- Subagents can access the same artifacts

### 2. **Deterministic Retrieval**
- `get_deck_vision("atraxa_superfriends")` always returns the same vision
- No relying on LLM memory or conversation context
- Artifacts are versioned and timestamped

### 3. **Observable Operations**
- All artifact operations are tool calls
- Visible in LangSmith traces
- Easy to debug (see exactly when vision was loaded)

### 4. **Structured Data**
- JSON schema for each artifact type
- Type validation at tool level
- Easy to query and filter

### 5. **Scalable**
- PostgresStore handles multi-user, multi-tenant scenarios
- Namespaces provide natural isolation
- Search/filter capabilities for power users

### 6. **Testable**
- Can mock store in tests
- Can seed test data easily
- Can assert on stored artifacts

---

## Migration Path

### Phase 1: Development (Current)
- Use `InMemoryStore` (already configured)
- Implement deck management tools
- Test with single user ("guest")

### Phase 2: Testing
- Add evals for artifact persistence
- Verify cross-thread access
- Test multi-deck scenarios

### Phase 3: Production
- Switch to `PostgresStore` (already have Postgres)
- Add user authentication
- Configure TTLs for artifact expiration

---

## Alternative Approaches (Rejected)

### ❌ Graph State Only
**Problem**: State is thread-scoped, can't share across conversations

### ❌ Middleware Injection
**Problem**: Not persistent, recomputed every request, no cross-thread

### ❌ Tool-Based Filesystem
**Problem**: No structure, no queries, manual serialization, path collisions

### ❌ External Database
**Problem**: Extra infrastructure, no LangGraph integration, manual plumbing

---

## Next Steps

1. **Create `src/tools/deck_manager.py`**
   - Implement North Star tools (create, get, list, update)
   - Implement Deck List tools (create, add_card, get, validate)
   - Implement Rubric tools (generate, get)
   - Implement Evaluation tools (evaluate, rank)

2. **Update `src/agent.py`**
   - Add PostgresStore configuration
   - Import and register deck management tools
   - Pass store to agent

3. **Update system prompts**
   - Add deck building workflow section
   - Emphasize loading artifacts before use
   - Provide tool usage examples

4. **Add to evaluations**
   - Test artifact persistence across threads
   - Verify namespace isolation
   - Check for deterministic retrieval

5. **Document for users**
   - Update PRD with persistence architecture
   - Add examples to README
   - Create user guide for multi-deck management

---

**Recommended Implementation Order**:
1. Deck Vision tools (North Star)
2. Deck List tools (state management)
3. Rubric tools (scoring criteria)
4. Evaluation tools (card scoring)

Start with Phase 1 (InMemoryStore) to validate the design, then migrate to Phase 3 (PostgresStore) for production.

