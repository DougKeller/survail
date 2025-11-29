# MTG Agent Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                USER REQUEST                                  │
│                 "Build a Commander deck around Atraxa"                       │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LANGGRAPH AGENT (Deep Agent)                        │
│                                                                              │
│  System Prompt: "Always load North Star before making recommendations..."   │
│  Tools: Scryfall + Query Builder + Stats + Deck Management                  │
│  Subagents: Research, Combo Eval, Brainstorming, Price Analysis            │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ TOOL: create_deck_vision()                                   │           │
│  │ Args: deck_name, primary_wincon, game_plan, pillars...       │           │
│  └──────────────────────────────────────────────────────────────┘           │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LANGGRAPH STORE (Postgres)                           │
│                                                                              │
│  Namespace: ("user_123", "deck_visions")                                    │
│  Key: "atraxa_superfriends"                                                 │
│  Value: {                                                                   │
│    "primary_wincon": "Planeswalker ultimates",                              │
│    "game_plan": { "early": "...", "mid": "...", "late": "..." },           │
│    "strategic_pillars": ["Card Advantage", "Proliferate", "Control"],      │
│    ...                                                                      │
│  }                                                                          │
│                                                                              │
│  ┌─────────────────┬──────────────────┬────────────────────────────┐       │
│  │ deck_visions    │ deck_rubrics     │ deck_lists                 │       │
│  │ (North Stars)   │ (Scoring Rules)  │ (Card Lists + Scores)      │       │
│  │                 │                  │                            │       │
│  │ • atraxa_sf     │ • atraxa_sf      │ • atraxa_sf                │       │
│  │ • kinnan_combo  │ • kinnan_combo   │ • kinnan_combo             │       │
│  │ • ...           │ • ...            │ • ...                      │       │
│  └─────────────────┴──────────────────┴────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘


TYPICAL WORKFLOW:
─────────────────

1. User: "Build a deck around Atraxa"
   ↓
2. Agent: create_deck_vision("Atraxa Superfriends", ...)
   → Store: PUT ("user_123", "deck_visions") / "atraxa_superfriends"
   ↓
3. Agent: generate_deck_rubric(deck_vision_id="atraxa_superfriends")
   ← Store: GET ("user_123", "deck_visions") / "atraxa_superfriends"
   → Store: PUT ("user_123", "deck_rubrics") / "atraxa_superfriends"
   ↓
4. Agent: create_deck("Atraxa Superfriends", vision_id="atraxa_superfriends")
   → Store: PUT ("user_123", "deck_lists") / "atraxa_superfriends"
   ↓
5. Agent (Research Subagent): search_cards("proliferate")
   → Scryfall API: Returns cards
   ↓
6. Agent: evaluate_card_for_deck("atraxa_superfriends", "Doubling Season")
   ← Store: GET ("user_123", "deck_visions") / "atraxa_superfriends"  (North Star)
   ← Store: GET ("user_123", "deck_rubrics") / "atraxa_superfriends"  (Rubric)
   ← Store: GET ("user_123", "deck_lists") / "atraxa_superfriends"    (Deck for synergy)
   → LLM: Evaluate card against rubric → { strategic_alignment: { ... }, ... }
   → Python: Calculate score → 95/100
   ↓
7. Agent: add_card_to_deck("atraxa_superfriends", "Doubling Season", ...)
   ← Store: GET ("user_123", "deck_lists") / "atraxa_superfriends"
   → Store: PUT ("user_123", "deck_lists") / "atraxa_superfriends" (with new card)
   ↓
8. ... (repeat for more cards)
   ↓
9. Agent: validate_deck("atraxa_superfriends")
   ← Store: GET ("user_123", "deck_lists") / "atraxa_superfriends"
   → Python: Check format legality, singleton rules, deck size, etc.
   → User: "✅ Deck is legal. 99/100 cards. Need 1 more."


CARD EVALUATION FLOW:
──────────────────────

evaluate_card_for_deck(deck_id="atraxa_superfriends", card_name="Doubling Season")
    │
    ├─→ Load North Star (from Store)
    │   └─→ Primary wincon, game plan, pillars
    │
    ├─→ Load Rubric (from Store)
    │   └─→ Strategic alignment (40%), format utility (30%), synergy (20%), meta (10%)
    │
    ├─→ Load Deck List (from Store)
    │   └─→ All cards with Oracle text for synergy evaluation
    │
    ├─→ Verify Card (Scryfall API, cached)
    │   └─→ get_card_by_name("Doubling Season") → Oracle text, mana cost, etc.
    │
    ├─→ LLM Evaluation (qualitative)
    │   Input: North Star + Rubric + Deck + Card
    │   Output: {
    │     "strategic_alignment": {
    │       "primary_wincon_support": {"rating": "critical", "reason": "..."},
    │       "game_plan_fit": {"rating": "strong", "reason": "..."}
    │     },
    │     "format_utility": { ... },
    │     "synergy": { ... },
    │     "meta_positioning": { ... }
    │   }
    │
    └─→ Deterministic Calculation (Python)
        Input: LLM qualitative ratings
        Process:
          - Convert ratings to numbers (critical=5, strong=4, ...)
          - Average dimensions per category
          - Apply category weights
          - Normalize to 0-100 scale
        Output: {
          "score": 95,
          "breakdown": {
            "strategic_alignment": 4.5,
            "format_utility": 4.0,
            "synergy": 5.0,
            "meta_positioning": 3.0
          }
        }


NAMESPACE STRUCTURE:
────────────────────

LangGraph Store uses hierarchical namespaces:

("user_123", "deck_visions")
    ├─ "atraxa_superfriends" → { primary_wincon, game_plan, ... }
    ├─ "kinnan_combo" → { ... }
    └─ ...

("user_123", "deck_rubrics")
    ├─ "atraxa_superfriends" → { strategic_alignment: {...}, format_utility: {...}, ... }
    ├─ "kinnan_combo" → { ... }
    └─ ...

("user_123", "deck_lists")
    ├─ "atraxa_superfriends" → { cards: [{name, score, rationale, ...}], statistics: {...} }
    ├─ "kinnan_combo" → { ... }
    └─ ...

("user_123", "card_evaluations")  # Cache
    ├─ "doubling_season_atraxa" → { score: 95, evaluation: {...}, cached_at: ... }
    └─ ...


PERSISTENCE BACKENDS:
──────────────────────

Development:
  InMemoryStore
    └─ Data lost on restart
    └─ Fast for testing
    └─ Already configured via deepagents

Production:
  PostgresStore(DATABASE_URL)
    └─ Same Postgres as checkpointer
    └─ Persistent across restarts
    └─ Multi-user support
    └─ Searchable with filters


CROSS-THREAD ACCESS:
────────────────────

Session 1 (Thread A):
  User: "Create a deck vision for Atraxa"
  → Store: PUT ("user_123", "deck_visions") / "atraxa_superfriends"

Session 2 (Thread B):
  User: "Continue building my Atraxa deck"
  → Agent: get_deck_vision("atraxa_superfriends")
  ← Store: GET ("user_123", "deck_visions") / "atraxa_superfriends"
  ✅ Vision retrieved from different thread!


EVALUATION SYSTEM:
──────────────────

Pytest + LangSmith Integration

1. Dataset: mtg-deck-tracking-eval
   Example: "Add 3 cards to a deck, then list them"
   Evaluator: deck_tracking_evaluator
   Metric: Are all 3 cards present? ✅/❌

2. Dataset: mtg-card-ranking-eval
   Example: "Rank Lightning Bolt vs Shock"
   Evaluator: card_ranking_evaluator
   Metric: Is Lightning Bolt ranked higher? ✅/❌

3. Dataset: mtg-card-verification-eval
   Example: "Tell me about Black Lotus"
   Evaluator: card_verification_evaluator (trajectory)
   Metric: Did agent call get_card_by_name() first? ✅/❌

Results → LangSmith Dashboard
  ├─ Trace visualization
  ├─ Tool call sequences
  ├─ Pass/fail per test
  └─ Experiment comparison
```

---

## Key Architectural Principles

### 1. **Separation of Concerns**
- **Agent**: Decision-making and orchestration
- **Tools**: Operations on data (Scryfall API, Store access)
- **Store**: Persistent data layer (cross-thread, cross-session)
- **LLM**: Qualitative evaluation only
- **Python**: Deterministic calculation and validation

### 2. **Explicit Over Implicit**
- Agent explicitly loads North Star via tool call (not assumed from context)
- Agent explicitly creates rubric via tool call (not inferred)
- Agent explicitly verifies cards via tool call (enforced at tool level)

### 3. **Observable Operations**
- All artifact access is via tools → visible in traces
- All evaluations are tool calls → logged and traceable
- All state changes are Store operations → auditable

### 4. **Cross-Thread Design**
- Artifacts stored in namespace, not thread state
- User can resume deck building in any session
- Subagents can access same artifacts as main agent

### 5. **Test-Driven Development**
- Evaluations written before implementation
- Baseline established (expect failures)
- Target metrics defined (95%+ pass rate)
- Re-evaluate after implementation

---

## Implementation Checklist

- [x] Design rubric system with 5-point scale
- [x] Create evaluation suite (16 test cases, 4 evaluators)
- [x] Document persistence architecture
- [ ] Implement deck management tools (`src/tools/deck_manager.py`)
- [ ] Configure PostgresStore in agent
- [ ] Update system prompts with deck workflow
- [ ] Run baseline evaluations
- [ ] Implement rubric generator
- [ ] Implement card evaluator
- [ ] Re-run evaluations (target: 90%+ pass)
- [ ] Update PRD with new architecture

