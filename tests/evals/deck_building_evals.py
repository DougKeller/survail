"""
LangSmith Evaluations for MTG Deck Building Agent

This test suite evaluates the agent's ability to:
1. Track and validate deck lists accurately
2. Rank and compare cards objectively
3. Verify card existence before discussing them

Based on failure modes identified in DECK_BUILDING_CHALLENGES.md

Usage:
    pytest tests/evals/deck_building_evals.py -v

Prerequisites:
    - LANGSMITH_API_KEY set in environment
    - Agent running locally or deployed
"""

import pytest
from typing import Any, Dict, List
from langsmith import Client
from langsmith.evaluation import evaluate, LangChainStringEvaluator
from langsmith.schemas import Run, Example
from agentevals import (
    create_trajectory_match_evaluator,
    create_trajectory_llm_as_judge,
    TRAJECTORY_ACCURACY_PROMPT,
)


# ============================================================================
# Dataset Definitions
# ============================================================================

DECK_TRACKING_DATASET = "mtg-deck-tracking-eval"
CARD_RANKING_DATASET = "mtg-card-ranking-eval"
CARD_VERIFICATION_DATASET = "mtg-card-verification-eval"


# ============================================================================
# Test Inputs for Deck List Tracking & Validation
# ============================================================================

DECK_TRACKING_EXAMPLES = [
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "Start building a Commander deck with Atraxa, Praetors' Voice as the commander."},
                {"role": "user", "content": "Add Doubling Season, Deepglow Skate, and Oath of Teferi."},
                {"role": "user", "content": "What cards are in my deck so far?"},
            ]
        },
        "expected_output": {
            "deck_name": "Atraxa",
            "commander": "Atraxa, Praetors' Voice",
            "cards": ["Doubling Season", "Deepglow Skate", "Oath of Teferi"],
            "total_count": 4,  # Commander + 3 cards
        },
        "eval_criteria": "Agent must correctly track all added cards and count",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "Start building a Modern deck."},
                {"role": "user", "content": "Add 4 Lightning Bolt and 4 Monastery Swiftspear."},
                {"role": "user", "content": "How many cards do I have?"},
            ]
        },
        "expected_output": {
            "total_count": 8,
            "cards": {
                "Lightning Bolt": 4,
                "Monastery Swiftspear": 4,
            }
        },
        "eval_criteria": "Agent must track quantities correctly for non-singleton formats",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "Start a Commander deck with Kinnan, Bonder Prodigy."},
                {"role": "user", "content": "Add Sol Ring and Sol Ring."},
                {"role": "user", "content": "Is my deck legal?"},
            ]
        },
        "expected_output": {
            "is_legal": False,
            "error": "singleton violation",
            "card": "Sol Ring",
        },
        "eval_criteria": "Agent must detect singleton rule violation in Commander",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "Start a Standard deck."},
                {"role": "user", "content": "Add Black Lotus."},
                {"role": "user", "content": "Is this deck legal?"},
            ]
        },
        "expected_output": {
            "is_legal": False,
            "error": "format legality",
            "illegal_cards": ["Black Lotus"],
        },
        "eval_criteria": "Agent must detect format legality violations",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "Start a Commander deck with Atraxa."},
                # Add many cards across conversation...
                {"role": "user", "content": "Add 20 different planeswalkers."},
                {"role": "user", "content": "Add 30 lands."},
                {"role": "user", "content": "How many cards do I still need?"},
            ]
        },
        "expected_output": {
            "current_count": 51,  # Commander + 20 PW + 30 lands
            "needed": 49,
            "target": 100,
        },
        "eval_criteria": "Agent must correctly track deck size and calculate remaining slots",
    },
]


# ============================================================================
# Test Inputs for Card Ranking & Comparison
# ============================================================================

CARD_RANKING_EXAMPLES = [
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "I'm building a Commander deck focused on +1/+1 counters with Atraxa. Compare these cards for inclusion: Doubling Season, Primal Vigor, and Branching Evolution."},
            ]
        },
        "expected_output": {
            "ranking": ["Doubling Season", "Primal Vigor", "Branching Evolution"],
            "scores": {
                "Doubling Season": {"score_range": (85, 100)},
                "Primal Vigor": {"score_range": (60, 80)},
                "Branching Evolution": {"score_range": (40, 70)},
            },
            "explanation_required": True,
        },
        "eval_criteria": "Agent must provide objective ranking with scores and clear reasoning",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "For a Modern burn deck, which is better: Lightning Bolt or Shock?"},
            ]
        },
        "expected_output": {
            "winner": "Lightning Bolt",
            "score_difference": {"min_difference": 20},
            "explanation_must_include": ["efficiency", "3 damage vs 2 damage", "mana efficiency"],
        },
        "eval_criteria": "Agent must clearly explain why Lightning Bolt is superior with concrete reasons",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "For a Commander deck focused on graveyard recursion with Meren, rank these: Eternal Witness, Regrowth, and Nature's Spiral."},
            ]
        },
        "expected_output": {
            "ranking": ["Eternal Witness", "Regrowth", "Nature's Spiral"],
            "must_consider": ["recurring value", "creature synergy", "efficiency"],
        },
        "eval_criteria": "Agent must consider recurring value (Eternal Witness can be reanimated) vs one-time effects",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "Compare Sol Ring and Mana Crypt for a competitive Commander deck."},
            ]
        },
        "expected_output": {
            "ranking": ["Mana Crypt", "Sol Ring"],
            "score_difference": {"max_difference": 10},  # Should be close
            "must_note": ["mana crypt risk", "both staples", "speed vs safety"],
        },
        "eval_criteria": "Agent must recognize both are staples with slight edge to Mana Crypt for speed",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "I have a deck with 10 slots left. Here are 15 candidate cards. Rank them and recommend the top 10."},
                # Provide 15 card names...
            ]
        },
        "expected_output": {
            "ranking_count": 15,
            "recommendation_count": 10,
            "scores_descending": True,
            "explanations_for_cuts": True,
        },
        "eval_criteria": "Agent must rank all 15, recommend top 10, and explain why bottom 5 didn't make the cut",
    },
]


# ============================================================================
# Test Inputs for Card Verification
# ============================================================================

CARD_VERIFICATION_EXAMPLES = [
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "Tell me about Black Lotus."},
            ]
        },
        "expected_trajectory": [
            {"tool": "get_card_by_name", "args": {"name": "Black Lotus"}},
        ],
        "eval_criteria": "Agent MUST call get_card_by_name before discussing the card",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "Compare Lightning Bolt and Shock."},
            ]
        },
        "expected_trajectory": [
            {"tool": "get_card_by_name", "args": {"name": "Lightning Bolt"}},
            {"tool": "get_card_by_name", "args": {"name": "Shock"}},
        ],
        "eval_criteria": "Agent MUST look up both cards before comparison",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "What does Rhystic Study do?"},
            ]
        },
        "expected_trajectory": [
            {"tool": "get_card_by_name", "args": {"name": "Rhystic Study"}},
        ],
        "eval_criteria": "Agent MUST retrieve Oracle text, not rely on pre-trained knowledge",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "I'm considering adding these to my deck: Sol Ring, Mana Crypt, and Arcane Signet. How do they work together?"},
            ]
        },
        "expected_trajectory": [
            # Agent should efficiently verify multiple cards at once
            {"tool": "search_cards", "args": {"query": "\"Sol Ring\" or \"Mana Crypt\" or \"Arcane Signet\""}},
        ],
        "alternative_trajectory": [
            {"tool": "get_card_by_name", "args": {"name": "Sol Ring"}},
            {"tool": "get_card_by_name", "args": {"name": "Mana Crypt"}},
            {"tool": "get_card_by_name", "args": {"name": "Arcane Signet"}},
        ],
        "eval_criteria": "Agent MUST verify all three cards (preferably in a single call)",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "Does Doubling Season work with planeswalkers?"},
            ]
        },
        "expected_trajectory": [
            {"tool": "get_card_by_name", "args": {"name": "Doubling Season"}},
            # Optional: Check rulings
            {"tool": "get_rulings_by_card_name", "args": {"card_name": "Doubling Season"}},
        ],
        "eval_criteria": "Agent MUST look up Doubling Season's Oracle text to answer accurately",
    },
    {
        "inputs": {
            "messages": [
                {"role": "user", "content": "Tell me about Uvenwald Oddity."},
            ]
        },
        "expected_behavior": {
            "must_attempt_lookup": True,
            "handle_404": True,
            "suggest_alternatives": True,
        },
        "eval_criteria": "Agent must attempt lookup, handle 'not found' gracefully, suggest corrections",
    },
]


# ============================================================================
# Custom Evaluators
# ============================================================================

def deck_tracking_evaluator(run: Run, example: Example) -> dict:
    """
    Evaluates whether the agent correctly tracked deck cards and counts.
    """
    output = run.outputs
    expected = example.outputs
    
    results = {
        "key": "deck_tracking_accuracy",
        "score": 0.0,
        "comment": "",
    }
    
    # Check if deck state was maintained
    if "deck" not in output and "cards" not in output:
        results["comment"] = "Agent did not maintain deck state"
        return results
    
    # Extract cards from output
    output_cards = output.get("cards", [])
    expected_cards = expected.get("cards", [])
    
    # Check card count accuracy
    output_count = output.get("total_count", len(output_cards))
    expected_count = expected.get("total_count", len(expected_cards))
    
    if output_count == expected_count:
        results["score"] += 0.5
    else:
        results["comment"] += f"Card count mismatch: expected {expected_count}, got {output_count}. "
    
    # Check if all expected cards are present
    missing_cards = set(expected_cards) - set(output_cards)
    extra_cards = set(output_cards) - set(expected_cards)
    
    if not missing_cards and not extra_cards:
        results["score"] += 0.5
        results["comment"] += "All cards correctly tracked."
    else:
        if missing_cards:
            results["comment"] += f"Missing cards: {missing_cards}. "
        if extra_cards:
            results["comment"] += f"Extra cards: {extra_cards}. "
    
    return results


def card_ranking_evaluator(run: Run, example: Example) -> dict:
    """
    Evaluates whether the agent provided objective card rankings with scores.
    """
    output = run.outputs
    expected = example.outputs
    
    results = {
        "key": "card_ranking_quality",
        "score": 0.0,
        "comment": "",
    }
    
    # Check if ranking was provided
    if "ranking" not in output:
        results["comment"] = "No ranking provided"
        return results
    
    output_ranking = output.get("ranking", [])
    expected_ranking = expected.get("ranking", [])
    
    # Check if ranking order matches expected
    if output_ranking == expected_ranking:
        results["score"] += 0.4
        results["comment"] += "Ranking order correct. "
    else:
        results["comment"] += f"Ranking mismatch: expected {expected_ranking}, got {output_ranking}. "
    
    # Check if scores were provided
    if "scores" in output or "score" in str(output).lower():
        results["score"] += 0.3
        results["comment"] += "Scores provided. "
    else:
        results["comment"] += "No scores provided. "
    
    # Check if explanation was provided
    if "explanation" in output or "reason" in output or len(str(output)) > 200:
        results["score"] += 0.3
        results["comment"] += "Explanation provided. "
    else:
        results["comment"] += "No explanation provided. "
    
    return results


def card_verification_evaluator(run: Run, example: Example) -> dict:
    """
    Evaluates whether the agent verified card existence before discussing it.
    
    This is a trajectory evaluator that checks if the agent called the appropriate tools.
    """
    results = {
        "key": "card_verification_compliance",
        "score": 0.0,
        "comment": "",
    }
    
    expected_trajectory = example.outputs.get("expected_trajectory", [])
    
    # Extract tool calls from run
    tool_calls = []
    if hasattr(run, "child_runs"):
        for child_run in run.child_runs:
            if child_run.run_type == "tool":
                tool_calls.append({
                    "tool": child_run.name,
                    "args": child_run.inputs,
                })
    
    # Check if expected tools were called
    for expected_call in expected_trajectory:
        expected_tool = expected_call["tool"]
        expected_args = expected_call.get("args", {})
        
        # Find matching tool call
        matching_call = None
        for call in tool_calls:
            if call["tool"] == expected_tool:
                # Check if args match (at least the key ones)
                args_match = all(
                    call["args"].get(k) == v
                    for k, v in expected_args.items()
                )
                if args_match:
                    matching_call = call
                    break
        
        if matching_call:
            results["score"] += 1.0 / len(expected_trajectory)
            results["comment"] += f"✓ Called {expected_tool}. "
        else:
            results["comment"] += f"✗ Did not call {expected_tool} with correct args. "
    
    return results


def format_legality_evaluator(run: Run, example: Example) -> dict:
    """
    Evaluates whether the agent correctly identified format legality violations.
    """
    output = run.outputs
    expected = example.outputs
    
    results = {
        "key": "format_legality_check",
        "score": 0.0,
        "comment": "",
    }
    
    # Check if legality was assessed
    if "is_legal" not in output and "legal" not in str(output).lower():
        results["comment"] = "Agent did not check format legality"
        return results
    
    # Check if the legality verdict is correct
    output_is_legal = output.get("is_legal", True)
    expected_is_legal = expected.get("is_legal", True)
    
    if output_is_legal == expected_is_legal:
        results["score"] += 0.5
        results["comment"] += "Correct legality verdict. "
    else:
        results["comment"] += f"Incorrect legality: expected {expected_is_legal}, got {output_is_legal}. "
    
    # If deck is illegal, check if the reason was identified
    if not expected_is_legal:
        expected_error = expected.get("error", "")
        if expected_error in str(output).lower():
            results["score"] += 0.5
            results["comment"] += f"Correctly identified error: {expected_error}. "
        else:
            results["comment"] += f"Did not identify error: {expected_error}. "
    
    return results


# ============================================================================
# Pytest Integration
# ============================================================================

@pytest.mark.eval
def test_deck_tracking_basic():
    """Test: Agent tracks cards added to deck accurately."""
    from src.agent import graph
    from langchain_core.messages import HumanMessage
    
    # Test case: Add 3 cards to a Commander deck
    result = graph.invoke({
        "messages": [
            HumanMessage(content="Start a Commander deck with Atraxa, Praetors' Voice."),
            HumanMessage(content="Add Doubling Season, Deepglow Skate, and Oath of Teferi."),
            HumanMessage(content="What cards are in my deck?"),
        ]
    })
    
    final_response = result["messages"][-1].content.lower()
    
    # Assert cards are mentioned
    assert "doubling season" in final_response, "Doubling Season not tracked"
    assert "deepglow skate" in final_response, "Deepglow Skate not tracked"
    assert "oath of teferi" in final_response, "Oath of Teferi not tracked"
    
    # Assert count is correct (4 = commander + 3 cards)
    # Note: This is a weak assertion; ideally we'd parse structured output
    assert "4" in final_response or "four" in final_response, "Card count incorrect"


@pytest.mark.eval
def test_singleton_violation_detection():
    """Test: Agent detects singleton rule violation in Commander."""
    from src.agent import graph
    from langchain_core.messages import HumanMessage
    
    result = graph.invoke({
        "messages": [
            HumanMessage(content="Start a Commander deck with Kinnan."),
            HumanMessage(content="Add Sol Ring."),
            HumanMessage(content="Add another Sol Ring."),
            HumanMessage(content="Is my deck legal?"),
        ]
    })
    
    final_response = result["messages"][-1].content.lower()
    
    # Assert that illegal/singleton violation is mentioned
    assert any(keyword in final_response for keyword in ["illegal", "singleton", "duplicate", "not legal"]), \
        "Agent did not detect singleton violation"


@pytest.mark.eval
def test_card_verification_before_discussion():
    """Test: Agent verifies card existence before discussing it."""
    from src.agent import graph
    from langchain_core.messages import HumanMessage
    
    # This is tricky to test without access to internal tool calls
    # In a real LangSmith setup, we'd use trajectory evaluators
    result = graph.invoke({
        "messages": [
            HumanMessage(content="Tell me what Black Lotus does."),
        ]
    })
    
    # At minimum, check that the response includes correct Oracle text
    final_response = result["messages"][-1].content.lower()
    
    # Black Lotus should mention "add three mana"
    assert "mana" in final_response, "Agent did not retrieve correct card info"
    assert "three" in final_response or "3" in final_response, "Oracle text not accurate"


@pytest.mark.eval
def test_card_ranking_with_scores():
    """Test: Agent provides objective ranking with scores."""
    from src.agent import graph
    from langchain_core.messages import HumanMessage
    
    result = graph.invoke({
        "messages": [
            HumanMessage(content="For a Modern burn deck, which is better: Lightning Bolt or Shock? Provide a score for each."),
        ]
    })
    
    final_response = result["messages"][-1].content.lower()
    
    # Assert that both cards are mentioned
    assert "lightning bolt" in final_response, "Lightning Bolt not discussed"
    assert "shock" in final_response, "Shock not discussed"
    
    # Assert that a scoring/ranking is provided
    assert any(keyword in final_response for keyword in ["score", "rank", "better", "rating"]), \
        "No ranking or scoring provided"
    
    # Assert that Lightning Bolt is ranked higher (qualitatively)
    # This is a weak check; ideally we'd parse structured output
    bolt_index = final_response.find("lightning bolt")
    shock_index = final_response.find("shock")
    better_index = final_response.find("better")
    
    # Check if "better" appears closer to "lightning bolt" than "shock"
    # (This is a very rough heuristic)
    if better_index > 0:
        assert abs(bolt_index - better_index) < abs(shock_index - better_index), \
            "Agent did not rank Lightning Bolt higher"


@pytest.mark.eval
def test_format_legality_check():
    """Test: Agent checks format legality correctly."""
    from src.agent import graph
    from langchain_core.messages import HumanMessage
    
    result = graph.invoke({
        "messages": [
            HumanMessage(content="I'm building a Standard deck. Can I include Black Lotus?"),
        ]
    })
    
    final_response = result["messages"][-1].content.lower()
    
    # Assert that the agent mentions Black Lotus is not legal
    assert any(keyword in final_response for keyword in ["not legal", "illegal", "banned", "not standard"]), \
        "Agent did not detect format legality violation"


# ============================================================================
# LangSmith Evaluation Runs
# ============================================================================

def run_langsmith_evaluations():
    """
    Run comprehensive evaluations using LangSmith's evaluate() function.
    
    This requires:
    - LangSmith datasets to be created
    - LANGSMITH_API_KEY to be set
    - Agent to be deployed or running locally
    """
    from langsmith import Client
    from langsmith.evaluation import evaluate
    
    client = Client()
    
    # Create datasets if they don't exist
    for dataset_name, examples in [
        (DECK_TRACKING_DATASET, DECK_TRACKING_EXAMPLES),
        (CARD_RANKING_DATASET, CARD_RANKING_EXAMPLES),
        (CARD_VERIFICATION_DATASET, CARD_VERIFICATION_EXAMPLES),
    ]:
        try:
            client.create_dataset(dataset_name, description=f"Evaluation dataset for {dataset_name}")
            for example in examples:
                client.create_example(
                    inputs=example["inputs"],
                    outputs=example.get("expected_output", {}),
                    dataset_name=dataset_name,
                    metadata={"eval_criteria": example.get("eval_criteria", "")},
                )
        except Exception as e:
            print(f"Dataset {dataset_name} may already exist: {e}")
    
    # Import agent
    from src.agent import graph
    
    def run_agent(inputs: dict) -> dict:
        """Wrapper to run agent for evaluation."""
        result = graph.invoke(inputs)
        return {"output": result["messages"][-1].content}
    
    # Run evaluations
    print("\n" + "="*80)
    print("Running Deck Tracking Evaluations...")
    print("="*80)
    evaluate(
        run_agent,
        data=DECK_TRACKING_DATASET,
        evaluators=[deck_tracking_evaluator, format_legality_evaluator],
        experiment_prefix="deck-tracking",
    )
    
    print("\n" + "="*80)
    print("Running Card Ranking Evaluations...")
    print("="*80)
    evaluate(
        run_agent,
        data=CARD_RANKING_DATASET,
        evaluators=[card_ranking_evaluator],
        experiment_prefix="card-ranking",
    )
    
    print("\n" + "="*80)
    print("Running Card Verification Evaluations...")
    print("="*80)
    
    # For trajectory evaluation, we need to use trajectory evaluators
    trajectory_evaluator = create_trajectory_llm_as_judge(
        model="openai:gpt-4",
        prompt=TRAJECTORY_ACCURACY_PROMPT,
    )
    
    evaluate(
        run_agent,
        data=CARD_VERIFICATION_DATASET,
        evaluators=[card_verification_evaluator, trajectory_evaluator],
        experiment_prefix="card-verification",
    )
    
    print("\n" + "="*80)
    print("Evaluation complete! Check LangSmith for detailed results.")
    print("="*80)


if __name__ == "__main__":
    """
    Run as a script to execute LangSmith evaluations.
    
    Usage:
        python tests/evals/deck_building_evals.py
    """
    import os
    
    if not os.getenv("LANGSMITH_API_KEY"):
        print("ERROR: LANGSMITH_API_KEY not set. Please set it in your environment.")
        exit(1)
    
    run_langsmith_evaluations()

