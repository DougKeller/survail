# Product Requirements Document: MTG Deep Agent System

**Version:** 1.0  
**Last Updated:** November 29, 2025  
**Status:** Active Development

---

## Executive Summary

The MTG Deep Agent System is an intelligent assistant designed to help Magic: The Gathering players with deck building, card research, strategy analysis, and budget optimization. The system combines comprehensive card database access with specialized analytical capabilities to provide expert-level guidance for players of all skill levels across all Magic formats.

---

## Product Vision

To provide Magic: The Gathering players with an intelligent, context-aware assistant that can understand complex deck building requirements, remember player preferences, conduct thorough research, and deliver actionable recommendations tailored to their specific format, budget, and playstyle.

---

## Target Users

### Primary Users
1. **Casual Players**: Building decks for fun, seeking creative ideas and budget alternatives
2. **Competitive Players**: Optimizing decks for tournaments, researching meta strategies
3. **Commander Players**: Building multiplayer decks with complex synergies and themes
4. **Budget-Conscious Players**: Finding cost-effective alternatives while maintaining deck viability

### Use Cases
- Building a new deck from scratch for a specific format
- Finding budget alternatives to expensive cards
- Evaluating card interactions and combo potential
- Researching cards for specific strategies or archetypes
- Understanding format legality and card rulings
- Comparing similar cards to make informed deck choices

---

## Core Capabilities

### 1. Comprehensive Card Research

The system provides access to Magic: The Gathering's complete card database with the ability to:

- **Search by Natural Language**: Users describe cards in plain English (e.g., "blue instant spells that draw cards") and the system finds matching cards
- **Card Details**: Retrieve complete information including Oracle text, mana cost, power/toughness, rulings, and prices
- **Set Information**: Look up Magic sets, release dates, and card availability
- **Format Legality**: Verify card legality across all formats (Standard, Modern, Commander, etc.)
- **Price Information**: Access current market prices from multiple vendors (TCGPlayer, Cardmarket, MTGO)
- **Rulings Lookup**: Find official rulings and clarifications for complex card interactions
- **Statistical Analysis**: Calculate probabilities, odds, and expected values for deck building decisions

### 2. Format-Aware Recommendations

The system adapts its recommendations based on the Magic format:

- **Format Clarification**: Always asks for format specification when making recommendations
- **Legality Filtering**: Only suggests cards legal in the specified format
- **Format-Specific Sorting**: Uses EDHREC rankings for Commander, price-based sorting for competitive formats
- **Format Context**: Understands that card evaluation differs by format (e.g., Commander staples vs. Modern staples)

**Supported Formats:**
- Commander/EDH (multiplayer, singleton)
- Standard (rotating format)
- Modern (non-rotating, 8th Edition forward)
- Pioneer (non-rotating, Return to Ravnica forward)
- Legacy (nearly all cards)
- Pauper (commons only)
- Vintage (all cards with restrictions)

### 3. Memory and Personalization

The system maintains context across conversations:

- **Short-Term Memory**: Tracks current research, working card lists, and active analysis within a session
- **Long-Term Memory**: Stores user preferences, format preferences, budget constraints, and deck building philosophy across sessions
- **Deck Vision Persistence**: Maintains "North Star" strategic documents that define deck goals and win conditions
- **Context Retrieval**: Automatically recalls relevant preferences when making new recommendations
- **Learning**: Remembers previously researched strategies and card synergies for faster future responses

**Stored Preferences May Include:**
- Preferred Magic formats
- Budget constraints (e.g., "cards under $5")
- Playstyle preferences (aggro, control, combo)
- Deck building philosophies
- Previously researched strategies
- Active deck visions with win conditions and game plans

### 3.1 Deck North Star Vision

For deck building tasks, the system establishes and maintains a **North Star Vision** - a strategic blueprint that guides all recommendations:

**Components of a North Star:**
1. **Primary Win Condition**: The main way the deck wins (required)
   - Example: "Combat damage with go-wide tokens"
   - Example: "Infinite combo with Thassa's Oracle"
   - Example: "Commander damage with voltron strategy"

2. **Game Plan by Phase**:
   - Early Game (Turns 1-3): Setup and positioning
   - Mid Game (Turns 4-6): Strategy development
   - Late Game (Turns 7+): Execution and closing

3. **Backup Plans**: Alternative strategies if primary plan fails

4. **Alternative Win Conditions** (optional): Secondary paths to victory

5. **Key Strategic Pillars**: Core themes supporting the strategy
   - Examples: Card advantage, mana ramp, board control, protection

**How It Works:**
- Created collaboratively with the user at the start of deck building
- Stored persistently in `/memories/deck_visions/<deck_name>.md`
- Referenced by ALL agents (main + subagents) before making recommendations
- Ensures all suggestions align with the deck's core strategy
- Prevents "generically good" cards that don't serve the specific vision

### 4. Planning and Task Management

For complex requests, the system breaks work into organized steps:

- **Automatic Planning**: Creates task lists for multi-step processes (e.g., deck building)
- **Progress Tracking**: Updates plans as new information is discovered
- **Status Visibility**: Shows what has been completed and what remains
- **Adaptive Planning**: Adjusts plans based on findings during research
- **Persistent Storage**: Uses an internal workspace to save research findings, card lists, and strategic notes

**Example Task Breakdown for "Build a Commander Deck":**
1. Define or load deck vision (North Star)
2. Research commander and core strategy
3. Find synergistic cards
4. Check card interactions
5. Optimize mana curve
6. Conduct budget analysis
7. Provide final recommendations

### 5. Specialized Analysis Agents

The system delegates complex subtasks to specialized agents:

#### Research Specialist
- **Purpose**: Deep investigation into card options and strategies
- **Use Case**: "Find all Modern-legal counterspells under 3 CMC"
- **Output**: Comprehensive analysis with data-driven recommendations organized by relevance, power level, or price
- **Value**: Isolates extensive card research and comparison from main conversation, keeping focus on high-level strategy

#### Combo Evaluator
- **Purpose**: Analyze card interactions and synergies
- **Use Case**: "Do these cards combo? Are there any anti-synergies?"
- **Output**: Clear assessment of synergy strength with explanation of why cards do or don't work together
- **Analysis Covers**: Timing conflicts, mana curve compatibility, contradictory effects, devotion/color requirements, recurring vs. one-time value
- **Value**: Prioritizes sustainable, repeatable value especially for longer formats like Commander

#### Brainstorming Agent
- **Purpose**: Generate creative deck concepts
- **Use Case**: "Give me unique deck ideas for a specific theme"
- **Output**: 3-5 distinct deck concepts with rationale
- **Focus**: Underplayed strategies, thematic builds, budget alternatives, format-specific opportunities
- **Value**: Explores many card combinations and ideas without cluttering main conversation with exploration process

#### Price Analyst
- **Purpose**: Budget optimization and value assessment
- **Use Case**: "Find budget alternatives to expensive cards"
- **Output**: Price-tiered recommendations with cost vs. power trade-off analysis
- **Analysis Covers**: Price trends, reprint availability, format staples vs. budget options, value per dollar
- **Value**: Conducts detailed price comparisons across multiple vendors and card printings

### 6. Probability and Statistical Analysis

The system provides comprehensive mathematical analysis for deck building decisions:

#### Basic Drawing Probabilities
- **Exactly N cards**: "What are the odds of drawing exactly 3 lands?"
- **At least N cards**: "What are the odds of drawing at least 1 combo piece?" (most common)
- **At most N cards**: "What are the odds of drawing at most 1 high-cost card?"
- **Range**: "What are the odds of drawing 2-4 lands in my opening hand?"

#### Conditional Probability (After Seeing Cards)
- **After Drawing**: "I drew 5 cards with no lands. What are my odds now?"
- **After Scrying**: "I scried 2 cards to the bottom. What are the chances of drawing a land?"
- **Dynamic Updates**: Probabilities update based on revealed information

#### Expected Value Analysis
- **Average Outcomes**: "On average, how many lands will I draw?"
- **Distribution Visualization**: See the full probability distribution with variance
- **Weighted Values**: "What's the expected mana value of my opening hand?"

#### Advanced Scenarios
- **Mulligan Analysis**: "What are my odds of getting 2-4 lands after 1 mulligan?"
- **By Turn Probability**: "By turn 4, what are the odds I've drawn a removal spell?"
- **Combo Assembly**: "What are the odds of having both combo pieces in my opening hand?"
- **Consistency Metrics**: "How consistent is my 24-land mana base?" (includes variance analysis)

#### Multi-Game Analysis
- **Across Games**: "Over 10 games, what are the odds I hit this combo at least 3 times?"
- **Expected Depth**: "How many draws until I see my first removal spell?"

**Value to Users:**
- **Data-Driven Decisions**: Make mana base and card density choices based on actual mathematics
- **Deck Optimization**: Understand consistency and reliability of card counts
- **Scenario Planning**: Evaluate mulligan strategies and turn-by-turn probabilities
- **Educational**: Learn about deck construction through probability analysis

---

## User Workflows

### Workflow 1: Building a Deck from Scratch

1. **User Request**: "Help me build a Commander deck around [Commander Name]"
2. **Format Clarification**: System confirms format (if not specified) and asks about budget
3. **North Star Creation**: 
   - System asks clarifying questions about strategy and win conditions
   - Creates a strategic blueprint with primary wincon, game plan, and backup plans
   - Saves to `/memories/deck_visions/` for persistent reference
4. **Planning**: System creates task list for deck building process
5. **Research Phase**: 
   - Delegates to Research Specialist for card options (filtered by North Star)
   - Stores findings in working memory
6. **Interaction Check**: Delegates to Combo Evaluator for synergy analysis (evaluated against North Star)
7. **Budget Optimization**: Delegates to Price Analyst if budget specified (while maintaining North Star alignment)
8. **Synthesis**: Compiles all research into organized deck recommendations that serve the North Star
9. **Memory**: Stores user preferences and deck strategy for future reference

### Workflow 2: Finding Budget Alternatives

1. **User Request**: "What's a budget alternative to [Expensive Card]?"
2. **Format Context**: System checks stored preferences or asks for format
3. **Analysis**: Price Analyst finds cards with similar effects at lower cost
4. **Comparison**: Presents alternatives with price and power level trade-offs
5. **Recommendation**: Explains which alternative best maintains deck viability

### Workflow 3: Evaluating Card Interactions

1. **User Request**: "Do [Card A] and [Card B] work well together?"
2. **Card Lookup**: System retrieves Oracle text for both cards
3. **Rules Check**: Looks up relevant rulings if needed
4. **Analysis**: Combo Evaluator assesses synergy, timing, and compatibility
5. **Explanation**: Provides clear assessment with reasoning

### Workflow 4: Creative Deck Ideation

1. **User Request**: "Give me creative deck ideas for [Theme/Colors]"
2. **Format Specification**: System asks for format context
3. **Brainstorming**: Brainstorming Agent generates multiple concepts
4. **Card Discovery**: Explores underplayed cards and unique synergies
5. **Presentation**: Presents 3-5 distinct ideas with rationale

### Workflow 5: Probability Analysis

1. **User Question**: "What are the odds of drawing at least 2 lands in my opening hand?"
2. **Parameter Recognition**: System identifies the probability question type
3. **Calculation**: Performs appropriate statistical analysis (hypergeometric, conditional, etc.)
4. **Result Presentation**: Returns probability as percentage and odds ratio with interpretation
5. **Context**: Explains what the numbers mean for deck building decisions

---

## System Behaviors

### Proactive Format Clarification

**Behavior**: When users request card recommendations without specifying a format, the system MUST ask for format before proceeding.

**Reasoning**: Format determines:
- Card legality (banned/restricted lists)
- Appropriate sorting (EDHREC for Commander, price for competitive)
- Card evaluation context (power level varies by format)

**Example Interactions:**
- User: "Find me the best ramp spells"
- System: "What format are you building for? (Standard, Modern, Commander, etc.)"
- User: "Commander"
- System: [Proceeds with Commander-specific recommendations]

### Graceful Error Handling

**Behavior**: When cards cannot be found, the system provides helpful guidance rather than technical error messages.

**Response Includes:**
- Clear explanation of what went wrong
- Possible reasons (misspelling, card doesn't exist in specified set)
- Actionable next steps (autocomplete suggestions, spelling help)
- Alternative search strategies

**Example:**
```
❌ Card not found: "Uvenwald Oddity"

Scryfall says: No cards found matching "Uvenwald Oddity"

Possible reasons:
- The card name might be misspelled
- The card might use a different name
- If it's a double-faced card, try the front face name

Suggestions:
- Use autocomplete to see similar card names
- Try a broader search
- Check spelling on Scryfall's website
```

### Context Preservation

**Behavior**: The system maintains conversation context and user preferences across sessions, including strategic deck visions.

**What Gets Remembered:**
- Format preferences
- Budget constraints
- Previously researched cards/strategies
- Deck building philosophy
- Recurring themes in user requests
- **Deck North Star visions**: Strategic blueprints defining deck goals, win conditions, and game plans

**What Gets Forgotten:**
- Temporary research data (cleared after task completion)
- Working calculations and comparisons

**North Star Benefits:**
- Ensures coherent, focused recommendations across all subagents
- Prevents "generically good" suggestions that don't serve the deck strategy
- Maintains strategic consistency throughout multi-step deck building
- Allows agents to evaluate trade-offs against a clear strategic framework

### Sort Order Intelligence

**Behavior**: The system automatically selects appropriate sort orders based on format and user intent.

**Sorting Logic:**

| Format | User Intent | Sort Method | Reasoning |
|--------|-------------|-------------|-----------|
| Commander | "Best" cards | EDHREC rank (ascending) | Community-validated popularity |
| Commander | Budget/cheap | Price (ascending) | Cost optimization |
| Standard/Modern/Pioneer | "Best" cards | Price (descending) | Price proxy for power level |
| Standard/Modern/Pioneer | Budget | Price (ascending) | Cost optimization |
| Any | New/recent | Release date (descending) | Chronological |
| Any | Powerful creatures | Power stat (descending) | Stat-based |

### Delegation to Specialists

**Behavior**: The system recognizes when a task requires deep focus and delegates to appropriate specialist agents. All specialists reference the active Deck North Star when applicable.

**Delegation Triggers:**
- Complex research requiring thorough investigation
- Interaction analysis needing rules expertise
- Creative ideation requiring unconventional thinking
- Budget optimization with multiple criteria

**North Star Integration:**
- All subagents automatically check for and load the relevant Deck North Star vision
- Recommendations are filtered and evaluated against the strategic blueprint
- Specialists explicitly note how suggestions align with primary wincon and game plan
- Ensures all agents "pull in the same direction" toward the deck's strategic goals

**User Experience**: Users receive concise summaries from specialist analysis without seeing internal delegation details, but with clear explanations of strategic alignment.

---

## Information Architecture

### Card Information Hierarchy

**Primary Information** (always shown):
- Card name
- Mana cost
- Type line
- Oracle text (rules text)
- Power/toughness (for creatures) or loyalty (for planeswalkers)

**Secondary Information** (shown on request or when relevant):
- Set and rarity
- Format legality
- Prices (USD, EUR, MTGO tickets)
- Artist and flavor text
- Related rulings

**Contextual Information** (shown based on search context):
- Why this card matches search criteria
- Comparison to similar cards
- Synergy notes with other cards
- Budget alternatives

### Search Result Presentation

**Default Behavior:**
- Show up to 175 cards per page
- Include search parameters used (filters, sorting)
- Note any assumptions made (default sorting, fuzzy matching)
- Indicate if more results are available

**Result Organization:**
- Group related cards when appropriate
- Highlight key distinguishing features
- Include price information when cost is relevant
- Show format legality for format-specific searches

---

## Success Criteria

### User Experience Goals

1. **Efficiency**: Users find relevant cards in 1-2 interactions
2. **Accuracy**: Recommendations match user's format and constraints 100% of the time
3. **Clarity**: Users understand why cards are recommended
4. **Personalization**: System remembers preferences and context across sessions
5. **Helpfulness**: Error messages guide users toward successful searches
6. **Data-Driven Confidence**: Users can validate deck building decisions with probability analysis

### Functional Requirements

1. **Card Database Coverage**: Access to complete Magic card database with current prices and rulings
2. **Format Compliance**: All recommendations respect format legality
3. **Memory Persistence**: User preferences persist across sessions
4. **Multi-Step Tasks**: Complex requests are broken down and completed systematically
5. **Specialist Quality**: Delegated analyses provide expert-level insights
6. **Mathematical Accuracy**: Probability calculations use correct statistical models (hypergeometric, binomial, etc.)

### Quality Standards

1. **Response Time**: Initial response within seconds, complex analyses within reasonable timeframes
2. **Accuracy**: Card information and rulings are current and correct
3. **Relevance**: Search results match user intent
4. **Completeness**: Multi-step tasks are completed fully
5. **Consistency**: Similar requests produce consistent recommendation patterns
6. **Statistical Rigor**: Probability calculations are mathematically sound and clearly explained

---

## Out of Scope

The following are explicitly NOT included in the current product scope:

1. **Deck Testing**: The system does not simulate games or test deck performance
2. **Card Images**: Card images are not displayed (only text information and links to images)
3. **Deck Export**: The system does not export deck lists to external formats (though it can organize recommendations)
4. **Real-Time Inventory**: The system does not track card availability or personal collections
5. **Trading/Purchasing**: The system does not facilitate card transactions
6. **Tournament Scheduling**: The system does not provide tournament information or scheduling
7. **Rules Adjudication**: While it provides rulings information, it does not make official rules decisions
8. **Game Simulation**: The system calculates probabilities but does not simulate actual gameplay scenarios

---

## Future Considerations

Potential enhancements for future versions:

1. **Collection Tracking**: Remember cards users own
2. **Deck Versioning**: Track deck iterations over time
3. **Meta Analysis**: Provide tournament meta insights
4. **Similarity Matching**: "Find decks similar to mine"
5. **Card Availability Alerts**: Notify when hard-to-find cards become available
6. **Community Integration**: Share and discover decks from other users
7. **Advanced Statistical Models**: Monte Carlo simulation for complex scenarios, Markov chains for multi-turn analysis
8. **Historical Price Tracking**: Price trend analysis and reprint prediction

---

## Appendix: Key Terminology

- **Oracle Text**: The official, current rules text for a card
- **Mana Value (CMC)**: Converted mana cost, the total cost to cast a card
- **Format**: A rule set defining which cards are legal (e.g., Standard, Modern, Commander)
- **Synergy**: When cards work well together, enhancing each other's effectiveness
- **Nonbo**: When cards work poorly together or contradict each other (anti-synergy)
- **EDHREC**: A community database ranking card popularity in Commander format
- **Staple**: A commonly played, powerful card in a specific format or archetype
- **Meta**: The current competitive landscape and popular strategies
- **Fuzzy Search**: Partial name matching that finds cards even with misspellings
- **Hypergeometric Distribution**: Statistical model for drawing cards without replacement (standard deck probability)
- **Conditional Probability**: Updated probabilities after seeing or drawing specific cards
- **Expected Value**: The average outcome across many trials
- **Variance**: A measure of how much outcomes differ from the expected value (consistency metric)
- **North Star Vision**: A strategic blueprint defining a deck's primary win condition, game plan, and backup strategies

---

**Document End**

