# Deck Building System Challenges & Proposed Solutions

**Date**: November 29, 2025  
**Status**: Design Proposal

---

## Observed Problems

### Problem 1: Deck List Tracking & Validation

**Issue**: The agent struggles to maintain accurate deck lists and validate them against format constraints.

**Specific Failures**:
- Loses track of which cards are in the deck across conversation turns
- Doesn't validate total card count (60 for constructed, 100 for Commander)
- Fails to check format legality for all cards in the list
- Doesn't catch duplicate cards (beyond singleton limits in Commander)
- No systematic validation of mana curve or color distribution

**Root Cause**: No structured data representation of the deck. The deck exists only in conversational context, which degrades over time and across subagent delegation.

---

### Problem 2: Card Ranking & Comparison

**Issue**: The agent cannot reliably rank cards against each other or explain why one card is better than another for a specific deck.

**Specific Failures**:
- Subjective, inconsistent evaluations ("this card seems good")
- No framework for comparing similar cards
- Doesn't weigh cards against the deck's strategic goals
- Can't explain trade-offs in concrete terms
- Rankings change between evaluations of the same cards

**Root Cause**: No objective scoring framework. Rankings are purely LLM intuition without structured criteria.

---

### Problem 3: Card Verification Failures

**Issue**: Despite prompts requiring card verification, the agent frequently discusses cards without looking them up, leading to hallucinations about card text and functionality.

**Specific Failures**:
- References cards without calling `get_card_by_name` or `search_cards`
- Makes incorrect claims about what a card does
- Misses key interactions because it doesn't have the actual Oracle text
- Forgets card details between mentions

**Root Cause**: 
1. Verification prompts are advisory, not enforced
2. No persistent card context across conversation
3. Agent assumes it "knows" common cards

---

## Proposed Solution: Structured Deck Building System

### Overview

Implement a **rubric-based scoring system** that:
1. Creates evaluation criteria from the deck's North Star
2. Scores cards objectively against those criteria
3. Maintains structured deck state with card data
4. Validates deck composition deterministically

---

## Component 1: Rubric Creation from North Star

### Concept

When a deck North Star is established, automatically generate an evaluation rubric that defines what makes a card "good" for this specific deck.

### Rubric Structure

```markdown
# Deck Rubric: [Deck Name]

## Strategic Alignment (Weight: 40%)

### Primary Win Condition Support
- **Critical**: Essential piece that directly enables or executes the primary wincon
- **Strong**: Significantly supports primary wincon or protects the strategy
- **Moderate**: Contributes to primary wincon in a supporting role
- **Weak**: Tangentially related to primary wincon
- **Irrelevant**: Unrelated to primary wincon

### Game Plan Phase Fit
- **Critical**: Perfect mana cost and effect for its intended phase, irreplaceable
- **Strong**: Excellent fit for its phase with efficient effect
- **Moderate**: Playable in correct phase with acceptable efficiency
- **Weak**: Slightly off-curve or suboptimal timing for its role
- **Irrelevant**: Wrong phase for its effect or prohibitively expensive

## Format-Specific Utility (Weight: 30%)

### Interaction & Removal
- **Critical**: Handles multiple common threats efficiently, format staple
- **Strong**: Answers key threats cleanly
- **Moderate**: Situational but useful interaction
- **Weak**: Narrow or inefficient removal
- **Irrelevant**: Doesn't interact with threats meaningfully

### Board Presence & Resilience
- **Critical**: Extremely difficult to remove, creates persistent advantage
- **Strong**: Solid presence with good protection or value
- **Moderate**: Reasonable presence, somewhat vulnerable
- **Weak**: Easily answered with minimal lasting impact
- **Irrelevant**: Negligible board impact or immediately removed

### Card Advantage & Resource Generation
- **Critical**: Recurring or game-winning card/mana advantage
- **Strong**: Significant one-time or conditional recurring advantage
- **Moderate**: Decent card draw or ramp effect
- **Weak**: Minimal or highly conditional advantage
- **Irrelevant**: No advantage generated or card-negative

## Synergy & Interactions (Weight: 20%)

### Deck Synergies
- **Critical**: Core combo piece, enables 3+ cards, multiplies value exponentially
- **Strong**: Synergizes with 2+ cards, significantly better with them
- **Moderate**: Minor synergies with 1-2 cards, decent standalone
- **Weak**: Works alone, no meaningful synergies
- **Irrelevant**: Anti-synergies or conflicts with deck strategy (nonbo)

### Redundancy & Consistency
- **Critical**: Provides critical redundant effect deck needs multiple copies of
- **Strong**: Important effect that deck wants redundancy for
- **Moderate**: Useful effect but deck doesn't need multiple
- **Weak**: Redundant with better options already in deck
- **Irrelevant**: Completely redundant with no upside over existing cards

## Format Meta & Weaknesses (Weight: 10%)

### Meta Positioning
- **Critical**: Hard counters prevalent strategies, meta-defining
- **Strong**: Very effective against common decks
- **Moderate**: Solid against some popular strategies
- **Weak**: Minimal meta relevance
- **Irrelevant**: Ineffective against or weak to meta strategies

### Deck Weakness Coverage
- **Critical**: Shores up critical, exploitable deck weakness
- **Strong**: Significantly helps with known major vulnerability
- **Moderate**: Provides some protection for minor weakness
- **Weak**: Marginally addresses weakness
- **Irrelevant**: Doesn't address weaknesses or exposes new ones
```

### Rating Scale Design Rationale

**5-Point Scale** (Critical → Irrelevant):
- **Semantic clarity**: Each rating has distinct meaning
- **Representative spread**: Captures full value range from essential to detrimental
- **LLM-friendly**: Qualitative descriptors LLMs can apply consistently
- **Deterministic mapping**: Clean conversion to numerical scores

**Why these specific terms:**
- **Critical**: Reserved for must-have cards (combo pieces, format staples)
- **Strong**: High-quality cards that clearly serve the strategy
- **Moderate**: Acceptable cards that do their job adequately
- **Weak**: Suboptimal choices with better alternatives available
- **Irrelevant**: Cards that don't help or actively hurt the strategy

### Rubric Generation Process

1. **Parse North Star** → Extract:
   - Primary wincon
   - Game plan by phase
   - Strategic pillars
   - Format constraints

2. **Identify Format Requirements** → Consider:
   - Common threats in format
   - Typical interaction suite needed
   - Mana curve expectations
   - Key synergies available

3. **Generate Custom Rubric** → Create criteria specific to:
   - This deck's strategy
   - This format's meta
   - This color combination's strengths/weaknesses

4. **Store in `/memories/deck_rubrics/[deck_name].md`**

---

## Component 2: Card Scoring System

### Scoring Architecture

```
Input: Card + Deck Context
  ↓
LLM Evaluator (scores each rubric dimension)
  ↓
Deterministic Calculator (converts qualitative → quantitative)
  ↓
Output: Numerical Score + Explanation
```

### Qualitative → Quantitative Mapping

```python
# 5-point rating scale with clear numerical values
RATING_SCORES = {
    "critical": 5,    # Must-have, essential to strategy
    "strong": 4,      # High-quality, clearly beneficial
    "moderate": 3,    # Acceptable, does the job
    "weak": 2,        # Suboptimal, better alternatives exist
    "irrelevant": 1,  # Doesn't help or actively hurts
}

# Category weights (must sum to 1.0)
WEIGHT_MULTIPLIERS = {
    "strategic_alignment": 0.40,  # Most important: does it serve the strategy?
    "format_utility": 0.30,       # Format-specific power level
    "synergy": 0.20,              # Interactions with other cards
    "meta_positioning": 0.10,     # Meta game considerations
}

# Each category has 2 dimensions
# Max possible score per dimension: 5
# Max possible score per category: (5 + 5) / 2 = 5.0
# Max possible weighted total: 5.0 * 1.0 = 5.0
# Normalized to 0-100: (score / 5.0) * 100
```

### Score Calculation Example

```python
# Example LLM evaluation output:
evaluation = {
    "strategic_alignment": {
        "primary_wincon_support": {"rating": "critical", "reason": "..."},  # 5
        "game_plan_fit": {"rating": "strong", "reason": "..."}              # 4
        # Average: (5 + 4) / 2 = 4.5
    },
    "format_utility": {
        "interaction": {"rating": "moderate", "reason": "..."},             # 3
        "board_presence": {"rating": "strong", "reason": "..."},            # 4
        "card_advantage": {"rating": "strong", "reason": "..."}             # 4
        # Average: (3 + 4 + 4) / 3 = 3.67
    },
    "synergy": {
        "deck_synergies": {"rating": "critical", "reason": "..."},          # 5
        "redundancy": {"rating": "moderate", "reason": "..."}               # 3
        # Average: (5 + 3) / 2 = 4.0
    },
    "meta_positioning": {
        "meta_positioning": {"rating": "moderate", "reason": "..."},        # 3
        "weakness_coverage": {"rating": "weak", "reason": "..."}            # 2
        # Average: (3 + 2) / 2 = 2.5
    }
}

# Weighted calculation:
final_score = (
    4.5 * 0.40 +   # Strategic alignment: 1.80
    3.67 * 0.30 +  # Format utility: 1.10
    4.0 * 0.20 +   # Synergy: 0.80
    2.5 * 0.10     # Meta: 0.25
)
# = 3.95

# Normalize to 0-100:
normalized_score = (3.95 / 5.0) * 100 = 79.0

# Result: This card scores 79/100 for this deck
```

### Structured LLM Output Format

The LLM evaluation must return valid JSON matching this schema:

```typescript
{
  "strategic_alignment": {
    "primary_wincon_support": {
      "rating": "critical" | "strong" | "moderate" | "weak" | "irrelevant",
      "reason": string  // 1-2 sentence justification
    },
    "game_plan_fit": {
      "rating": "critical" | "strong" | "moderate" | "weak" | "irrelevant",
      "reason": string
    }
  },
  "format_utility": {
    "interaction": { "rating": ..., "reason": ... },
    "board_presence": { "rating": ..., "reason": ... },
    "card_advantage": { "rating": ..., "reason": ... }
  },
  "synergy": {
    "deck_synergies": { "rating": ..., "reason": ... },
    "redundancy": { "rating": ..., "reason": ... }
  },
  "meta_positioning": {
    "meta_positioning": { "rating": ..., "reason": ... },
    "weakness_coverage": { "rating": ..., "reason": ... }
  }
}
```

**Validation Requirements**:
- All ratings must be exactly one of: `critical`, `strong`, `moderate`, `weak`, `irrelevant`
- All reasons must be non-empty strings
- All required dimensions must be present
- JSON must be parseable

### Scoring Input Context

For each card evaluation, provide:

1. **Card Data**:
   ```
   Name: [Card Name]
   Mana Cost: [Cost]
   Type: [Type Line]
   Oracle Text: [Full Rules Text]
   ```

2. **Deck Context**:
   ```
   North Star: [Primary wincon, game plan, pillars]
   Current Deck List: [All cards with Oracle text]
   Format: [Format name + key meta info]
   ```

3. **Rationale** (if provided):
   ```
   Why this card was considered: [User's reasoning or suggestion]
   ```

### LLM Evaluation Prompt

```
You are evaluating a card for inclusion in a deck.

DECK NORTH STAR:
[North Star details]

RUBRIC:
[Full rubric with dimensions and rating scales]

CARD TO EVALUATE:
[Card details with Oracle text]

CURRENT DECK LIST (for synergy evaluation):
[All cards currently in deck with Oracle text]

RATIONALE:
[Why this card is being considered]

TASK:
For each rubric dimension, assign a rating (Excellent/Good/Okay/Poor) and provide a brief justification (1 sentence).

Output your evaluation as structured JSON:
{
  "strategic_alignment": {
    "primary_wincon_support": {"rating": "critical", "reason": "..."},
    "game_plan_fit": {"rating": "strong", "reason": "..."}
  },
  "format_utility": {
    "interaction": {"rating": "strong", "reason": "..."},
    "board_presence": {"rating": "moderate", "reason": "..."},
    "card_advantage": {"rating": "critical", "reason": "..."}
  },
  "synergy": {
    "deck_synergies": {"rating": "strong", "reason": "..."},
    "redundancy": {"rating": "moderate", "reason": "..."}
  },
  "meta_positioning": {
    "meta_positioning": {"rating": "moderate", "reason": "..."},
    "weakness_coverage": {"rating": "weak", "reason": "..."}
  }
}

VALID RATINGS: critical, strong, moderate, weak, irrelevant
```

### Deterministic Calculation

```python
def calculate_card_score(evaluation: dict, weights: dict) -> tuple[float, dict]:
    """
    Convert LLM qualitative evaluation to numerical score.
    
    Args:
        evaluation: LLM output with ratings for each dimension
        weights: Category weights (must sum to 1.0)
    
    Returns:
        Tuple of (final_score, breakdown)
        - final_score: 0-100 normalized score
        - breakdown: Dict with per-category scores for transparency
    """
    category_scores = {}
    
    for category, dimensions in evaluation.items():
        dimension_scores = [
            RATING_SCORES[dim["rating"]] 
            for dim in dimensions.values()
        ]
        # Average across dimensions in category
        category_scores[category] = sum(dimension_scores) / len(dimension_scores)
    
    # Weighted sum across categories
    raw_score = sum(
        category_scores[cat] * weights[cat] 
        for cat in category_scores
    )
    
    # Normalize to 0-100 scale (max possible raw score is 5.0)
    normalized_score = (raw_score / 5.0) * 100
    
    breakdown = {
        "raw_score": raw_score,
        "normalized_score": normalized_score,
        "category_scores": category_scores,
        "weighted_contributions": {
            cat: category_scores[cat] * weights[cat]
            for cat in category_scores
        }
    }
    
    return normalized_score, breakdown


def rank_cards(scored_cards: List[dict]) -> List[dict]:
    """
    Deterministically rank cards by score.
    
    Args:
        scored_cards: List of cards with scores
    
    Returns:
        Cards sorted by score (highest first), with rank numbers
    """
    ranked = sorted(scored_cards, key=lambda x: x["score"], reverse=True)
    
    # Add rank numbers (1-indexed)
    for i, card in enumerate(ranked, 1):
        card["rank"] = i
    
    return ranked
```

---

## Component 3: Batch Evaluation System

### Problem: Scoring 60-100 cards individually is expensive

### Solution: Batch processing with caching

```python
async def batch_evaluate_cards(
    cards: List[str],  # Card names
    deck_context: dict,
    rubric: dict,
    batch_size: int = 10
) -> List[dict]:
    """
    Evaluate multiple cards in parallel batches.
    
    Process:
    1. Fetch all card data (cached from Scryfall)
    2. Group into batches
    3. Submit LLM evaluation requests in parallel
    4. Cache results per card
    5. Return scored cards
    """
    # Fetch card data (leverages Scryfall LRU cache)
    card_data = await fetch_cards_parallel(cards)
    
    # Group into batches
    batches = [cards[i:i+batch_size] for i in range(0, len(cards), batch_size)]
    
    # Process batches in parallel
    results = []
    for batch in batches:
        batch_results = await evaluate_batch_parallel(batch, deck_context, rubric)
        results.extend(batch_results)
    
    # Calculate scores deterministically
    scored_cards = [
        {
            "name": card["name"],
            "evaluation": result,
            "score": calculate_card_score(result, weights),
        }
        for card, result in zip(card_data, results)
    ]
    
    return scored_cards
```

### Caching Strategy

```python
# Cache evaluations per (card_name, rubric_hash, deck_hash)
@lru_cache(maxsize=512)
def get_cached_evaluation(
    card_name: str,
    rubric_hash: str,  # Hash of rubric criteria
    deck_hash: str,    # Hash of deck list for synergy context
) -> Optional[dict]:
    """
    Retrieve cached evaluation if rubric and deck haven't changed.
    """
    pass
```

**Cache Invalidation**:
- Rubric changes → Invalidate all evaluations for that deck
- Deck composition changes → Invalidate all evaluations (synergies change)
- Card added/removed → Recalculate only affected cards

---

## Component 4: Structured Deck State

### Deck State File Structure

Store in `/memories/deck_lists/[deck_name].json`:

```json
{
  "name": "Atraxa Superfriends",
  "format": "commander",
  "commander": "Atraxa, Praetors' Voice",
  "north_star_id": "atraxa_superfriends",
  "rubric_id": "atraxa_superfriends",
  "cards": [
    {
      "name": "Doubling Season",
      "quantity": 1,
      "category": "engine",
      "oracle_text": "If an effect would create...",
      "mana_cost": "{4}{G}",
      "cmc": 5,
      "colors": ["G"],
      "type_line": "Enchantment",
      "score": 95,
      "evaluation": { /* full rubric evaluation */ },
      "synergies": ["Oath of Teferi", "Carth the Lion"],
      "rationale": "Doubles loyalty counters and creature tokens"
    }
  ],
  "validation": {
    "total_cards": 100,
    "is_legal": true,
    "warnings": [],
    "missing_categories": ["board_wipes"]
  },
  "statistics": {
    "avg_cmc": 3.2,
    "color_distribution": {"W": 15, "U": 20, "B": 18, "G": 22},
    "type_counts": {"creature": 25, "planeswalker": 15, "instant": 8},
    "avg_score": 72.5
  }
}
```

### Deck Validation Function

```python
def validate_deck(deck: dict) -> dict:
    """
    Deterministically validate deck composition.
    
    Checks:
    - Card count matches format (60/100)
    - All cards are format-legal
    - Commander color identity matches cards (if Commander)
    - Singleton rule (if Commander)
    - Mana curve is reasonable
    - Color distribution is playable
    
    Returns:
        {
            "is_valid": bool,
            "errors": List[str],
            "warnings": List[str],
            "suggestions": List[str]
        }
    """
    pass
```

---

## Component 5: Enforced Card Verification

### Problem: Agent doesn't verify cards despite prompts

### Solution: Enforce verification at tool level

```python
@tool
def discuss_card(card_name: str, context: str) -> str:
    """
    Discuss a card's role in the deck.
    
    This tool AUTOMATICALLY fetches card data before allowing discussion.
    The agent cannot discuss a card without having its Oracle text.
    
    Args:
        card_name: Name of the card
        context: What aspect to discuss (synergies, role, alternatives, etc.)
        
    Returns:
        Card data + discussion prompt
    """
    # ALWAYS fetch card data first
    card_data = get_card_by_name(card_name)
    
    if "not found" in card_data.lower():
        return f"Cannot discuss {card_name} - card not found. Please verify the name."
    
    # Return card data + context for discussion
    return f"""
CARD DATA (verified):
{card_data}

DISCUSSION CONTEXT: {context}

Now discuss this card based on the verified data above.
"""
```

### Deck Context Tool

```python
@tool
def get_deck_context(deck_name: str) -> str:
    """
    Load full deck list with all card Oracle text.
    
    This ensures the agent has complete context for synergy evaluation.
    
    Returns:
        Full deck list with verified card data
    """
    deck = load_deck(deck_name)
    
    result = f"DECK: {deck['name']} ({deck['format']})\n\n"
    result += "CARDS IN DECK:\n"
    
    for card in deck["cards"]:
        result += f"\n{card['name']} ({card['mana_cost']})\n"
        result += f"  {card['type_line']}\n"
        result += f"  {card['oracle_text']}\n"
        if card.get('synergies'):
            result += f"  Synergizes with: {', '.join(card['synergies'])}\n"
    
    return result
```

---

## Implementation Workflow

### 1. Deck Building Initialization
```
User: "Build a Commander deck around Atraxa"
  ↓
Agent: Create North Star
  ↓
Agent: Generate Rubric from North Star
  ↓
Agent: Initialize Deck State file
```

### 2. Card Consideration
```
Agent considers card: "Doubling Season"
  ↓
Tool: get_card_by_name("Doubling Season") [ENFORCED]
  ↓
Tool: evaluate_card_for_deck(card, deck_context, rubric)
  ↓
Tool: add_card_to_deck(card, score, evaluation)
  ↓
Agent: Explain score and synergies to user
```

### 3. Deck Review & Ranking
```
User: "Show me the best cards in the deck"
  ↓
Tool: load_deck(deck_name)
  ↓
Function: rank_cards(deck.cards)
  ↓
Agent: Present top 10 with scores and reasoning
```

### 4. Deck Validation
```
User: "Is my deck legal and optimized?"
  ↓
Tool: validate_deck(deck_name)
  ↓
Tool: analyze_deck_statistics(deck_name)
  ↓
Agent: Report issues, warnings, suggestions with scores
```

---

## Benefits of This Approach

### 1. **Objectivity**
- Consistent scoring across all cards
- Repeatable evaluations
- Clear criteria for "good" vs "bad"

### 2. **Traceability**
- Every card has a score breakdown
- Can explain why Card A > Card B
- Rubric criteria linked to North Star

### 3. **Validation**
- Deterministic deck checking
- Format legality guaranteed
- Mana curve and color distribution validated

### 4. **Efficiency**
- Batch processing for multiple cards
- Caching prevents redundant LLM calls
- Scryfall cache serves card data instantly

### 5. **Accuracy**
- Enforced card verification
- Oracle text always available
- No hallucinations about card effects

### 6. **Persistence**
- Deck state saved and resumable
- Scores and evaluations persist
- Can track deck evolution over time

---

## Open Questions

1. **Rubric Customization**: Should users be able to edit rubrics, or are they purely derived from North Star?

2. **Re-evaluation Triggers**: When should cards be re-scored? (North Star change? Deck composition change? Manual request?)

3. **Subagent Integration**: Should scoring be delegated to a specialized subagent, or handled by main agent?

4. **Score Thresholds**: What score constitutes "good enough" for inclusion? 70? 80?

5. **Alternative Cards**: Should the system suggest alternatives with higher scores when evaluating a card?

6. **Batch Size**: What's optimal for parallel LLM calls? 10? 20?

7. **Cache TTL**: How long should evaluations be cached? Session-based? Indefinite?

---

## Next Steps

1. Create `deck_manager` tool module with:
   - Deck state persistence
   - Validation functions
   - Scoring functions

2. Create `rubric_generator` subagent:
   - Reads North Star
   - Generates format-specific criteria
   - Saves rubric file

3. Create `card_evaluator` tool:
   - Batch evaluation support
   - LRU caching of evaluations
   - Deterministic scoring

4. Update main agent prompt:
   - Reference rubric system
   - Enforce deck context loading
   - Require scores when comparing cards

5. Add deck management commands:
   - `create_deck()`
   - `add_card_with_evaluation()`
   - `rank_deck_cards()`
   - `validate_deck()`
   - `suggest_improvements()`

---

**Document Status**: Ready for implementation discussion and refinement.

