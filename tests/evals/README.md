# MTG Agent Evaluations

This directory contains evaluation tests for the MTG Deck Building Agent, based on identified failure modes documented in `docs/DECK_BUILDING_CHALLENGES.md`.

## Overview

The evaluation suite tests three critical failure modes:

1. **Deck List Tracking & Validation**: Ensures the agent maintains accurate deck state and validates format constraints
2. **Card Ranking & Comparison**: Verifies the agent provides objective, score-based card rankings
3. **Card Verification**: Confirms the agent always verifies card existence before discussing cards

## Requirements

```bash
# Install dependencies
uv pip install pytest langsmith agentevals

# Set environment variables
export LANGSMITH_API_KEY=your_api_key_here
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_PROJECT=mtg-agent-evals
```

## Running Evaluations

### Run all evaluations

```bash
pytest tests/evals/deck_building_evals.py -v
```

### Run specific evaluation categories

```bash
# Only deck tracking tests
pytest tests/evals/deck_building_evals.py::test_deck_tracking_basic -v

# Only card verification tests
pytest tests/evals/deck_building_evals.py::test_card_verification_before_discussion -v

# Only card ranking tests
pytest tests/evals/deck_building_evals.py::test_card_ranking_with_scores -v
```

### Run with LangSmith integration

```bash
# Run full LangSmith evaluation suite (creates datasets, runs all evaluators)
python tests/evals/deck_building_evals.py
```

This will:
1. Create LangSmith datasets with test examples
2. Run the agent on each example
3. Evaluate outputs with custom evaluators
4. Upload results to LangSmith for visualization

## Evaluation Types

### 1. Trajectory Evaluations

These tests verify that the agent calls the correct tools in the correct order.

**Example**: Card Verification
- **Input**: "Tell me about Black Lotus"
- **Expected Trajectory**: Must call `get_card_by_name("Black Lotus")` before discussing
- **Evaluator**: `card_verification_evaluator` + LLM-as-judge trajectory evaluator

### 2. Final Response Evaluations

These tests assess the quality of the agent's final output.

**Example**: Card Ranking
- **Input**: "Which is better: Lightning Bolt or Shock?"
- **Expected Output**: Ranking with scores and explanations
- **Evaluator**: `card_ranking_evaluator`

### 3. State Management Evaluations

These tests check if the agent maintains accurate state across conversation turns.

**Example**: Deck Tracking
- **Input**: Multi-turn conversation adding cards
- **Expected State**: All cards tracked with correct counts
- **Evaluator**: `deck_tracking_evaluator`

## Test Datasets

### Deck Tracking Dataset (`mtg-deck-tracking-eval`)

- Add cards to deck and verify tracking
- Detect singleton violations (Commander)
- Detect format legality violations
- Calculate remaining deck slots correctly

**5 test cases**

### Card Ranking Dataset (`mtg-card-ranking-eval`)

- Compare cards with objective scores
- Rank multiple cards in priority order
- Consider recurring value vs one-time effects
- Explain trade-offs between similar cards

**5 test cases**

### Card Verification Dataset (`mtg-card-verification-eval`)

- Verify single card before discussion
- Verify multiple cards in comparison
- Handle "card not found" gracefully
- Use efficient multi-card verification

**6 test cases**

## Custom Evaluators

### `deck_tracking_evaluator`
- **Checks**: Card count accuracy, card list completeness
- **Score**: 0.0 - 1.0 (0.5 for count, 0.5 for card list)

### `card_ranking_evaluator`
- **Checks**: Ranking order, score provision, explanation quality
- **Score**: 0.0 - 1.0 (0.4 order, 0.3 scores, 0.3 explanation)

### `card_verification_evaluator`
- **Checks**: Correct tools called with correct arguments
- **Score**: 0.0 - 1.0 (1.0 / N for each expected tool call)

### `format_legality_evaluator`
- **Checks**: Correct legality verdict, correct error identification
- **Score**: 0.0 - 1.0 (0.5 verdict, 0.5 error reason)

## Viewing Results

### In Terminal (Pytest)

```bash
pytest tests/evals/deck_building_evals.py -v
```

Output shows pass/fail for each test with assertions.

### In LangSmith Dashboard

```bash
python tests/evals/deck_building_evals.py
```

Then visit: https://smith.langchain.com/

- View detailed traces for each test case
- Compare evaluation scores across runs
- Inspect tool calls and intermediate states
- Export results for analysis

## Adding New Tests

1. **Define test case** in the appropriate `*_EXAMPLES` list:
```python
{
    "inputs": {"messages": [...]},
    "expected_output": {...},
    "eval_criteria": "Description of what's being tested",
}
```

2. **Write pytest test** if testing deterministic behavior:
```python
@pytest.mark.eval
def test_my_new_behavior():
    from src.agent import graph
    from langchain_core.messages import HumanMessage
    
    result = graph.invoke({"messages": [...]})
    assert some_condition, "Failure message"
```

3. **Create custom evaluator** if testing nuanced behavior:
```python
def my_custom_evaluator(run: Run, example: Example) -> dict:
    return {
        "key": "my_metric",
        "score": 0.0 - 1.0,
        "comment": "Explanation",
    }
```

4. **Add to evaluation run**:
```python
evaluate(
    run_agent,
    data=MY_DATASET,
    evaluators=[my_custom_evaluator],
    experiment_prefix="my-test",
)
```

## Interpreting Results

### Success Criteria

**Deck Tracking**:
- ✅ All tests pass: Agent maintains perfect deck state
- ⚠️ Some tests fail: Agent loses track of cards across turns
- ❌ Most tests fail: Critical state management issues

**Card Ranking**:
- ✅ All tests pass: Agent provides objective, score-based rankings
- ⚠️ Some tests fail: Rankings are sometimes subjective or inconsistent
- ❌ Most tests fail: Agent cannot rank cards objectively

**Card Verification**:
- ✅ All tests pass: Agent always verifies cards before discussion
- ⚠️ Some tests fail: Agent sometimes relies on pre-trained knowledge
- ❌ Most tests fail: Agent rarely verifies cards, frequent hallucinations

### Expected Baseline (Before Fix)

Based on `DECK_BUILDING_CHALLENGES.md`, we expect the current agent to **FAIL** most of these tests:

- **Deck Tracking**: ~40% pass rate (loses state across subagent calls)
- **Card Ranking**: ~20% pass rate (no objective scoring framework)
- **Card Verification**: ~30% pass rate (prompts are advisory, not enforced)

### Target Performance (After Fix)

After implementing the structured deck building system:

- **Deck Tracking**: 95%+ pass rate (structured JSON state)
- **Card Ranking**: 90%+ pass rate (rubric-based scoring)
- **Card Verification**: 95%+ pass rate (enforced at tool level)

## CI/CD Integration

To run these evaluations in CI:

```yaml
# .github/workflows/evals.yml
name: Agent Evaluations

on: [push, pull_request]

jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install uv
          uv pip install -r requirements.txt
          uv pip install pytest langsmith agentevals
      
      - name: Run evaluations
        env:
          LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_API_KEY }}
          AZURE_OPENAI_API_KEY: ${{ secrets.AZURE_OPENAI_API_KEY }}
        run: |
          pytest tests/evals/deck_building_evals.py -v
```

## Troubleshooting

### "Dataset not found" error

Create datasets manually:
```python
from langsmith import Client
client = Client()
client.create_dataset("mtg-deck-tracking-eval", description="...")
```

### "Agent not responding" error

Ensure agent is running:
```bash
# Start local agent
uv run langgraph dev

# Or test agent directly
uv run python -c "from src.agent import graph; print(graph)"
```

### "Tool calls not captured" error

Ensure LangSmith tracing is enabled:
```bash
export LANGCHAIN_TRACING_V2=true
export LANGSMITH_API_KEY=your_key
```

## References

- [LangSmith Evaluation Docs](https://docs.langchain.com/langsmith/evaluation)
- [AgentEvals Package](https://docs.langchain.com/langsmith/trajectory-evals)
- [Pytest Integration](https://docs.langchain.com/langsmith/evaluation-concepts)
- [Deck Building Challenges Doc](../../docs/DECK_BUILDING_CHALLENGES.md)

