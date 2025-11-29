"""
Statistical analysis tools for Magic: The Gathering probability calculations.

This module provides a comprehensive suite of statistical functions for deck building
and gameplay analysis, including hypergeometric distributions, conditional probabilities,
expected value calculations, consistency analysis, and more.
"""

from math import comb, factorial, sqrt
from typing import List, Tuple, Optional, Dict
from langchain.tools import tool
import random


# ============================================================================
# CORE PROBABILITY FUNCTIONS (Internal Helpers)
# ============================================================================


def _hypergeometric_probability(
    population_size: int,
    success_count: int,
    sample_size: int,
    desired_successes: int
) -> float:
    """
    Calculate hypergeometric probability (drawing without replacement).
    
    This is the foundation for most MTG probability calculations.
    
    Args:
        population_size: Total number of cards (e.g., deck size)
        success_count: Number of "success" cards in population (e.g., lands)
        sample_size: Number of cards drawn
        desired_successes: Number of successes we want
        
    Returns:
        Probability as a decimal (0.0 to 1.0)
    """
    if desired_successes > success_count or desired_successes > sample_size:
        return 0.0
    
    if sample_size > population_size or sample_size < 0:
        return 0.0
    
    if success_count > population_size or success_count < 0:
        return 0.0
    
    # Hypergeometric formula: C(K,k) * C(N-K, n-k) / C(N,n)
    # Where: N=population, K=successes in population, n=sample, k=desired successes
    try:
        numerator = comb(success_count, desired_successes) * comb(
            population_size - success_count,
            sample_size - desired_successes
        )
        denominator = comb(population_size, sample_size)
        return numerator / denominator if denominator > 0 else 0.0
    except (ValueError, ZeroDivisionError, OverflowError):
        return 0.0


def _binomial_probability(
    trials: int,
    success_probability: float,
    desired_successes: int
) -> float:
    """
    Calculate binomial probability (independent trials with replacement).
    
    Used for scenarios where each draw is independent (like multiple games,
    or effects that return cards to deck).
    
    Args:
        trials: Number of independent trials
        success_probability: Probability of success on each trial (0.0 to 1.0)
        desired_successes: Number of successes we want
        
    Returns:
        Probability as a decimal (0.0 to 1.0)
    """
    if desired_successes > trials or desired_successes < 0:
        return 0.0
    
    try:
        # Binomial formula: C(n,k) * p^k * (1-p)^(n-k)
        combinations = comb(trials, desired_successes)
        success_part = success_probability ** desired_successes
        failure_part = (1 - success_probability) ** (trials - desired_successes)
        return combinations * success_part * failure_part
    except (ValueError, ZeroDivisionError, OverflowError):
        return 0.0


def _geometric_expectation(
    success_probability: float
) -> float:
    """
    Calculate expected number of trials until first success (geometric distribution).
    
    Args:
        success_probability: Probability of success on each trial
        
    Returns:
        Expected number of trials as a float
    """
    if success_probability <= 0:
        return float('inf')
    return 1.0 / success_probability


def _negative_binomial_expectation(
    success_probability: float,
    target_successes: int
) -> float:
    """
    Calculate expected number of trials until Nth success (negative binomial).
    
    Args:
        success_probability: Probability of success on each trial
        target_successes: Number of successes needed
        
    Returns:
        Expected number of trials as a float
    """
    if success_probability <= 0:
        return float('inf')
    return target_successes / success_probability


def _calculate_variance(probabilities: List[Tuple[int, float]]) -> Tuple[float, float]:
    """
    Calculate variance and standard deviation from a probability distribution.
    
    Args:
        probabilities: List of (value, probability) tuples
        
    Returns:
        Tuple of (variance, standard_deviation)
    """
    # Calculate mean (expected value)
    mean = sum(value * prob for value, prob in probabilities)
    
    # Calculate variance: E[(X - μ)²]
    variance = sum(((value - mean) ** 2) * prob for value, prob in probabilities)
    
    # Standard deviation is sqrt of variance
    std_dev = sqrt(variance)
    
    return variance, std_dev


# ============================================================================
# TOOL 1-4: HYPERGEOMETRIC TOOLS (Drawing Without Replacement)
# ============================================================================


@tool
def probability_of_drawing_exactly(
    deck_size: int,
    cards_in_category: int,
    cards_drawn: int,
    target_count: int
) -> str:
    """
    Calculate the probability of drawing EXACTLY a specific number of cards from a category.
    
    Uses hypergeometric distribution (drawing without replacement).
    Best for: Opening hand analysis, drawing from a static deck.
    
    Args:
        deck_size: Total cards in deck (typically 60 for constructed, 99+1 for Commander)
        cards_in_category: How many cards of this type are in the deck (e.g., 24 lands)
        cards_drawn: How many cards you're drawing (e.g., opening hand of 7)
        target_count: The exact number you want to draw (e.g., exactly 3 lands)
        
    Returns:
        Human-readable probability result with percentage and odds ratio.
        
    Example:
        "What are the odds of drawing exactly 3 lands in my opening 7?"
        probability_of_drawing_exactly(60, 24, 7, 3)
    """
    prob = _hypergeometric_probability(deck_size, cards_in_category, cards_drawn, target_count)
    percentage = prob * 100
    
    # Calculate odds ratio (e.g., "1 in 5.2")
    odds_ratio = 1 / prob if prob > 0 else float('inf')
    
    result = f"**Probability of drawing exactly {target_count} card(s)**\n\n"
    result += f"- **Deck size**: {deck_size}\n"
    result += f"- **Cards in category**: {cards_in_category}\n"
    result += f"- **Cards drawn**: {cards_drawn}\n"
    result += f"- **Target count**: Exactly {target_count}\n\n"
    result += f"**Result**: {percentage:.2f}% (approximately 1 in {odds_ratio:.1f})\n"
    
    return result


@tool
def probability_of_drawing_at_least(
    deck_size: int,
    cards_in_category: int,
    cards_drawn: int,
    minimum_count: int
) -> str:
    """
    Calculate the probability of drawing AT LEAST a specific number of cards from a category.
    
    Uses hypergeometric distribution. This is one of the MOST COMMON calculations.
    Best for: "Do I have at least 1 combo piece?" "At least 2 lands?"
    
    Args:
        deck_size: Total cards in deck
        cards_in_category: How many cards of this type are in the deck
        cards_drawn: How many cards you're drawing
        minimum_count: The minimum number you want to draw (e.g., at least 2 lands)
        
    Returns:
        Human-readable probability result with percentage and odds ratio.
        
    Example:
        "What are the odds of drawing at least 2 lands in my opening 7?"
        probability_of_drawing_at_least(60, 24, 7, 2)
    """
    # Sum probabilities for minimum_count through cards_drawn
    total_prob = 0.0
    max_possible = min(cards_in_category, cards_drawn)
    
    for count in range(minimum_count, max_possible + 1):
        total_prob += _hypergeometric_probability(
            deck_size, cards_in_category, cards_drawn, count
        )
    
    percentage = total_prob * 100
    odds_ratio = 1 / total_prob if total_prob > 0 else float('inf')
    
    result = f"**Probability of drawing at least {minimum_count} card(s)**\n\n"
    result += f"- **Deck size**: {deck_size}\n"
    result += f"- **Cards in category**: {cards_in_category}\n"
    result += f"- **Cards drawn**: {cards_drawn}\n"
    result += f"- **Minimum count**: At least {minimum_count}\n\n"
    result += f"**Result**: {percentage:.2f}% (approximately 1 in {odds_ratio:.1f})\n"
    
    return result


@tool
def probability_of_drawing_at_most(
    deck_size: int,
    cards_in_category: int,
    cards_drawn: int,
    maximum_count: int
) -> str:
    """
    Calculate the probability of drawing AT MOST a specific number of cards from a category.
    
    Uses hypergeometric distribution.
    Best for: "No more than 1 land" (mull analysis), "at most 2 high-drops"
    
    Args:
        deck_size: Total cards in deck
        cards_in_category: How many cards of this type are in the deck
        cards_drawn: How many cards you're drawing
        maximum_count: The maximum number you want to draw (e.g., at most 1 land)
        
    Returns:
        Human-readable probability result with percentage and odds ratio.
        
    Example:
        "What are the odds of drawing at most 1 land in my opening 7?"
        probability_of_drawing_at_most(60, 24, 7, 1)
    """
    # Sum probabilities for 0 through maximum_count
    total_prob = 0.0
    
    for count in range(0, maximum_count + 1):
        total_prob += _hypergeometric_probability(
            deck_size, cards_in_category, cards_drawn, count
        )
    
    percentage = total_prob * 100
    odds_ratio = 1 / total_prob if total_prob > 0 else float('inf')
    
    result = f"**Probability of drawing at most {maximum_count} card(s)**\n\n"
    result += f"- **Deck size**: {deck_size}\n"
    result += f"- **Cards in category**: {cards_in_category}\n"
    result += f"- **Cards drawn**: {cards_drawn}\n"
    result += f"- **Maximum count**: At most {maximum_count}\n\n"
    result += f"**Result**: {percentage:.2f}% (approximately 1 in {odds_ratio:.1f})\n"
    
    return result


@tool
def probability_of_drawing_range(
    deck_size: int,
    cards_in_category: int,
    cards_drawn: int,
    minimum_count: int,
    maximum_count: int
) -> str:
    """
    Calculate the probability of drawing between a minimum and maximum number of cards.
    
    Uses hypergeometric distribution.
    Best for: "2-4 lands in opening hand", "3-5 creatures"
    
    Args:
        deck_size: Total cards in deck
        cards_in_category: How many cards of this type are in the deck
        cards_drawn: How many cards you're drawing
        minimum_count: Minimum number you want (inclusive)
        maximum_count: Maximum number you want (inclusive)
        
    Returns:
        Human-readable probability result with breakdown by count.
        
    Example:
        "What are the odds of drawing 2-4 lands in my opening 7?"
        probability_of_drawing_range(60, 24, 7, 2, 4)
    """
    if minimum_count > maximum_count:
        return "❌ Error: minimum_count cannot be greater than maximum_count"
    
    # Calculate probability for each count in range
    total_prob = 0.0
    breakdown = []
    
    for count in range(minimum_count, maximum_count + 1):
        prob = _hypergeometric_probability(
            deck_size, cards_in_category, cards_drawn, count
        )
        total_prob += prob
        breakdown.append((count, prob * 100))
    
    percentage = total_prob * 100
    odds_ratio = 1 / total_prob if total_prob > 0 else float('inf')
    
    result = f"**Probability of drawing {minimum_count}-{maximum_count} card(s)**\n\n"
    result += f"- **Deck size**: {deck_size}\n"
    result += f"- **Cards in category**: {cards_in_category}\n"
    result += f"- **Cards drawn**: {cards_drawn}\n\n"
    result += f"**Overall Result**: {percentage:.2f}% (approximately 1 in {odds_ratio:.1f})\n\n"
    result += "**Breakdown by count**:\n"
    
    for count, prob in breakdown:
        result += f"  - Exactly {count}: {prob:.2f}%\n"
    
    return result


# ============================================================================
# TOOL 5-6: CONDITIONAL PROBABILITY (After Seeing Cards)
# ============================================================================


@tool
def conditional_probability_after_seeing(
    original_deck_size: int,
    cards_in_category: int,
    cards_seen: int,
    category_cards_seen: int,
    cards_to_draw: int,
    target_count: int
) -> str:
    """
    Calculate probability AFTER seeing some cards (conditional probability).
    
    Critical for in-game decision making after scrying, surveilling, or drawing.
    Updates probabilities based on revealed information.
    
    Args:
        original_deck_size: Starting deck size
        cards_in_category: How many cards of this type were originally in deck
        cards_seen: Total cards you've seen/revealed
        category_cards_seen: How many of the seen cards were from your target category
        cards_to_draw: How many more cards you'll draw
        target_count: Target number of category cards in the new draw
        
    Returns:
        Updated probability with comparison to original odds.
        
    Example:
        "I scried 2 lands to the bottom. What are my odds of drawing a land now?"
        conditional_probability_after_seeing(60, 24, 2, 2, 1, 1)
        
    Example 2:
        "I drew 5 cards (no lands). What are the odds my next 2 draws both have lands?"
        conditional_probability_after_seeing(60, 24, 5, 0, 2, 2)
    """
    # Calculate remaining deck state
    remaining_deck_size = original_deck_size - cards_seen
    remaining_category = cards_in_category - category_cards_seen
    
    if remaining_deck_size < 0 or remaining_category < 0:
        return "❌ Error: Invalid parameters (more cards seen than available)"
    
    # Calculate NEW probability with updated deck state
    new_prob = 0.0
    if target_count == 0:
        # Special case: probability of drawing 0
        new_prob = _hypergeometric_probability(
            remaining_deck_size, remaining_category, cards_to_draw, 0
        )
    else:
        # For "at least" interpretation
        for count in range(target_count, min(remaining_category, cards_to_draw) + 1):
            new_prob += _hypergeometric_probability(
                remaining_deck_size, remaining_category, cards_to_draw, count
            )
    
    # Calculate what the probability WOULD have been originally
    original_prob = 0.0
    if target_count == 0:
        original_prob = _hypergeometric_probability(
            original_deck_size, cards_in_category, cards_to_draw, 0
        )
    else:
        for count in range(target_count, min(cards_in_category, cards_to_draw) + 1):
            original_prob += _hypergeometric_probability(
                original_deck_size, cards_in_category, cards_to_draw, count
            )
    
    new_percentage = new_prob * 100
    original_percentage = original_prob * 100
    change = new_percentage - original_percentage
    
    result = f"**Conditional Probability After Seeing Cards**\n\n"
    result += f"**Original Deck State:**\n"
    result += f"  - Deck size: {original_deck_size}\n"
    result += f"  - Cards in category: {cards_in_category}\n"
    result += f"  - Original probability: {original_percentage:.2f}%\n\n"
    
    result += f"**Information Gained:**\n"
    result += f"  - Cards seen/revealed: {cards_seen}\n"
    result += f"  - Category cards among them: {category_cards_seen}\n\n"
    
    result += f"**Updated Deck State:**\n"
    result += f"  - Remaining deck size: {remaining_deck_size}\n"
    result += f"  - Remaining category cards: {remaining_category}\n\n"
    
    result += f"**New Probability** (drawing {target_count}+ in next {cards_to_draw}):\n"
    result += f"  - **{new_percentage:.2f}%** (approximately 1 in {1/new_prob if new_prob > 0 else float('inf'):.1f})\n"
    result += f"  - Change from original: {change:+.2f} percentage points\n"
    
    if change > 5:
        result += f"\n✅ **Your odds have improved significantly!**\n"
    elif change < -5:
        result += f"\n⚠️ **Your odds have decreased significantly.**\n"
    else:
        result += f"\n➡️ **Odds are roughly similar to before.**\n"
    
    return result


@tool
def probability_after_partial_information(
    deck_size: int,
    cards_in_category: int,
    known_top_cards: int,
    category_in_top: int,
    cards_to_draw: int,
    target_count: int
) -> str:
    """
    Calculate probability when you know what some top cards are (e.g., after scrying).
    
    Similar to conditional_probability_after_seeing, but specifically for known deck top.
    Best for: Scry decisions, topdeck analysis, surveil decisions.
    
    Args:
        deck_size: Current deck size
        cards_in_category: Total cards of target type in deck
        known_top_cards: How many top cards you know about
        category_in_top: How many category cards are in those known top cards
        cards_to_draw: How many cards you'll draw from the top
        target_count: How many category cards you want in that draw
        
    Returns:
        Probability analysis for drawing from a partially known deck.
        
    Example:
        "I scried 3, saw 1 land on top. Drawing 2 cards. Odds of getting a land?"
        probability_after_partial_information(57, 23, 3, 1, 2, 1)
    """
    # This is a conditional probability problem
    # If we're drawing from the known top cards, the probability is deterministic
    # If we're drawing past them, we need to account for the unknown portion
    
    if cards_to_draw <= known_top_cards:
        # We're only drawing from known cards
        # Use hypergeometric on the known subset
        prob = _hypergeometric_probability(
            known_top_cards, category_in_top, cards_to_draw, target_count
        )
        percentage = prob * 100
        
        result = f"**Probability from Known Top Cards**\n\n"
        result += f"- **Known top cards**: {known_top_cards}\n"
        result += f"- **Category cards in known top**: {category_in_top}\n"
        result += f"- **Drawing**: {cards_to_draw} cards\n"
        result += f"- **Target**: At least {target_count} category cards\n\n"
        result += f"**Result**: {percentage:.2f}%\n"
        result += f"(Drawing only from known cards)\n"
        
        return result
    else:
        # We're drawing some known + some unknown cards
        known_draws = known_top_cards
        unknown_draws = cards_to_draw - known_top_cards
        unknown_deck_size = deck_size - known_top_cards
        unknown_category_cards = cards_in_category - category_in_top
        
        # Calculate probability for all possible outcomes from known portion
        total_prob = 0.0
        
        for known_hits in range(max(0, target_count - unknown_draws), 
                                 min(category_in_top, known_draws) + 1):
            # Probability of getting known_hits from the known portion
            known_prob = _hypergeometric_probability(
                known_top_cards, category_in_top, known_draws, known_hits
            )
            
            # How many more do we need from unknown portion?
            needed_from_unknown = max(0, target_count - known_hits)
            
            # Probability of getting the rest from unknown portion
            unknown_prob = 0.0
            for unknown_hits in range(needed_from_unknown, 
                                       min(unknown_category_cards, unknown_draws) + 1):
                unknown_prob += _hypergeometric_probability(
                    unknown_deck_size, unknown_category_cards, 
                    unknown_draws, unknown_hits
                )
            
            total_prob += known_prob * unknown_prob
        
        percentage = total_prob * 100
        
        result = f"**Probability from Partially Known Deck**\n\n"
        result += f"**Known Information:**\n"
        result += f"  - Top {known_top_cards} cards known\n"
        result += f"  - {category_in_top} category cards in known top\n\n"
        result += f"**Unknown Information:**\n"
        result += f"  - {unknown_deck_size} cards unknown\n"
        result += f"  - ~{unknown_category_cards} category cards in unknown\n\n"
        result += f"**Drawing**: {cards_to_draw} cards total\n"
        result += f"  - {known_draws} from known top\n"
        result += f"  - {unknown_draws} from unknown deck\n\n"
        result += f"**Result**: {percentage:.2f}% chance of {target_count}+ category cards\n"
        
        return result


# ============================================================================
# TOOL 7-8: EXPECTED VALUE & DISTRIBUTION ANALYSIS
# ============================================================================


@tool
def expected_count_and_distribution(
    deck_size: int,
    cards_in_category: int,
    cards_drawn: int
) -> str:
    """
    Calculate expected number (average) and full distribution of cards drawn.
    
    Shows the complete probability distribution with mean, variance, and standard deviation.
    Best for: Understanding typical outcomes and consistency.
    
    Args:
        deck_size: Total cards in deck
        cards_in_category: Cards of this type in deck
        cards_drawn: How many cards you're drawing
        
    Returns:
        Expected value, variance, std deviation, and full distribution with visual bar chart.
        
    Example:
        "On average, how many lands will I draw in my opening 7?"
        expected_count_and_distribution(60, 24, 7)
    """
    # Expected value for hypergeometric = n * K / N
    expected = (cards_drawn * cards_in_category) / deck_size
    
    # Calculate the full distribution
    distribution = []
    max_possible = min(cards_in_category, cards_drawn)
    
    for count in range(0, max_possible + 1):
        prob = _hypergeometric_probability(
            deck_size, cards_in_category, cards_drawn, count
        )
        distribution.append((count, prob))
    
    # Calculate variance and standard deviation
    variance, std_dev = _calculate_variance(distribution)
    
    result = f"**Expected Count and Distribution Analysis**\n\n"
    result += f"- **Deck size**: {deck_size}\n"
    result += f"- **Cards in category**: {cards_in_category}\n"
    result += f"- **Cards drawn**: {cards_drawn}\n\n"
    result += f"**Expected value (mean)**: {expected:.2f} cards\n"
    result += f"**Variance**: {variance:.2f}\n"
    result += f"**Standard deviation**: {std_dev:.2f}\n"
    result += f"**Most likely outcome**: {max(distribution, key=lambda x: x[1])[0]} cards\n\n"
    result += "**Full probability distribution**:\n"
    
    for count, prob in distribution:
        percentage = prob * 100
        if percentage >= 0.01:  # Only show probabilities >= 0.01%
            bar = "█" * int(percentage / 2)  # Visual bar (scaled)
            result += f"  {count}: {percentage:5.2f}% {bar}\n"
    
    # Add interpretation
    result += f"\n**Interpretation**:\n"
    result += f"- You'll typically draw {expected:.1f} ± {std_dev:.1f} cards of this type\n"
    result += f"- {std_dev:.1f} std dev means {'high consistency' if std_dev < 1.5 else 'moderate variance'}\n"
    
    return result


@tool
def expected_value_weighted(
    deck_size: int,
    card_categories: List[int],
    category_values: List[float],
    cards_drawn: int
) -> str:
    """
    Calculate expected value when different cards have different values/impacts.
    
    Unlike expected_count, this weights outcomes by their value.
    Best for: "Expected damage", "expected mana value", "expected card advantage"
    
    Args:
        deck_size: Total cards in deck
        card_categories: List of card counts for each category [8, 12, 4]
        category_values: Value/impact of each category [3.0, 1.5, 5.0]
        cards_drawn: How many cards you're drawing
        
    Returns:
        Expected total value from the drawn cards.
        
    Example:
        "Expected total mana value in opening hand"
        expected_value_weighted(60, [24, 20, 16], [0, 2, 4], 7)
        (lands=0 mana, low drops=2, high drops=4)
    """
    if len(card_categories) != len(category_values):
        return "❌ Error: card_categories and category_values must have same length"
    
    if sum(card_categories) > deck_size:
        return "❌ Error: Total cards in categories exceeds deck size"
    
    # Calculate expected count for each category
    expected_counts = []
    for count in card_categories:
        expected = (cards_drawn * count) / deck_size
        expected_counts.append(expected)
    
    # Calculate weighted expected value
    total_expected_value = sum(
        exp_count * value 
        for exp_count, value in zip(expected_counts, category_values)
    )
    
    result = f"**Weighted Expected Value Analysis**\n\n"
    result += f"- **Deck size**: {deck_size}\n"
    result += f"- **Cards drawn**: {cards_drawn}\n\n"
    result += "**Categories**:\n"
    
    for i, (count, value, expected) in enumerate(
        zip(card_categories, category_values, expected_counts), 1
    ):
        result += f"  {i}. {count} cards @ {value:.1f} value each\n"
        result += f"     → Expected to draw {expected:.2f} cards\n"
        result += f"     → Expected value contribution: {expected * value:.2f}\n"
    
    result += f"\n**Total Expected Value**: {total_expected_value:.2f}\n"
    result += f"\nThis represents the average total value across all drawn cards.\n"
    
    return result


# ============================================================================
# TOOL 9-10: GEOMETRIC & NEGATIVE BINOMIAL (Until Success)
# ============================================================================


@tool
def expected_draws_until_first(
    deck_size: int,
    cards_in_category: int,
    already_drawn: int = 0
) -> str:
    """
    Calculate expected number of draws until you see your FIRST target card.
    
    Uses geometric distribution expectation.
    Best for: "How deep do I need to dig?", "What turn will I likely draw X?"
    
    Args:
        deck_size: Total cards in deck
        cards_in_category: How many cards of this type are in the deck
        already_drawn: Cards already drawn (reduces deck size)
        
    Returns:
        Expected number of draws until first success.
        
    Example:
        "How many draws until I see my first removal spell?"
        expected_draws_until_first(60, 8, 0)
        
    Example 2:
        "I've drawn 10 cards, seen no lands. How many more until a land?"
        expected_draws_until_first(60, 24, 10)
    """
    remaining_deck = deck_size - already_drawn
    
    if remaining_deck <= 0:
        return "❌ Error: No cards remaining in deck"
    
    if cards_in_category <= 0:
        return "❌ Error: No target cards in deck"
    
    # Probability of drawing a target card on any given draw
    success_prob = cards_in_category / remaining_deck
    
    # Expected draws = 1 / p for geometric distribution
    expected = _geometric_expectation(success_prob)
    
    result = f"**Expected Draws Until First Success**\n\n"
    result += f"- **Remaining deck size**: {remaining_deck}\n"
    result += f"- **Target cards remaining**: {cards_in_category}\n"
    result += f"- **Probability per draw**: {success_prob * 100:.2f}%\n\n"
    result += f"**Expected draws until first hit**: {expected:.1f} cards\n\n"
    
    # Calculate probability of hitting within certain draws
    result += "**Probability of hitting within N draws**:\n"
    for draws in [1, 2, 3, 5, 10]:
        if draws <= remaining_deck:
            # P(hit within N) = 1 - P(miss all N)
            prob_hit = 1 - ((1 - success_prob) ** draws)
            result += f"  - Within {draws} draws: {prob_hit * 100:.1f}%\n"
    
    return result


@tool
def expected_draws_until_nth(
    deck_size: int,
    cards_in_category: int,
    target_successes: int,
    already_drawn: int = 0
) -> str:
    """
    Calculate expected number of draws until you see N target cards.
    
    Uses negative binomial distribution expectation.
    Best for: "How many draws until 2 lands?", "Until I see both combo pieces?"
    
    Args:
        deck_size: Total cards in deck
        cards_in_category: How many cards of this type are in the deck
        target_successes: How many target cards you need (N)
        already_drawn: Cards already drawn
        
    Returns:
        Expected number of draws until Nth success.
        
    Example:
        "How many draws until I see 2 lands?"
        expected_draws_until_nth(60, 24, 2, 0)
    """
    remaining_deck = deck_size - already_drawn
    
    if remaining_deck <= 0:
        return "❌ Error: No cards remaining in deck"
    
    if cards_in_category < target_successes:
        return f"❌ Error: Only {cards_in_category} target cards in deck, need {target_successes}"
    
    # Approximate probability (assumes independence, which is conservative)
    success_prob = cards_in_category / remaining_deck
    
    # Expected draws = N / p for negative binomial
    expected = _negative_binomial_expectation(success_prob, target_successes)
    
    result = f"**Expected Draws Until {target_successes} Successes**\n\n"
    result += f"- **Remaining deck size**: {remaining_deck}\n"
    result += f"- **Target cards remaining**: {cards_in_category}\n"
    result += f"- **Target successes**: {target_successes}\n"
    result += f"- **Approximate probability per draw**: {success_prob * 100:.2f}%\n\n"
    result += f"**Expected draws until {target_successes} hits**: ~{expected:.1f} cards\n\n"
    result += "*Note: This is an approximation assuming independent draws.*\n"
    
    return result


# ============================================================================
# TOOL 11: BINOMIAL PROBABILITY (With Replacement / Independent)
# ============================================================================


@tool
def probability_across_independent_trials(
    trials: int,
    single_trial_success_probability: float,
    minimum_successes: int
) -> str:
    """
    Calculate probability across independent trials (binomial distribution).
    
    Use when trials are INDEPENDENT (e.g., multiple games, or with replacement).
    Best for: "Over 10 games, what are odds I hit this 5+ times?"
    
    Args:
        trials: Number of independent trials (e.g., games played)
        single_trial_success_probability: Probability of success in ONE trial (0.0 to 1.0)
        minimum_successes: Minimum number of successes you want
        
    Returns:
        Probability of achieving minimum successes across all trials.
        
    Example:
        "Over 10 games, if I have a 15% chance per game, what are odds I hit it 2+ times?"
        probability_across_independent_trials(10, 0.15, 2)
    """
    if not (0 <= single_trial_success_probability <= 1):
        return "❌ Error: Success probability must be between 0 and 1"
    
    # Calculate cumulative probability for minimum_successes or more
    total_prob = 0.0
    
    for successes in range(minimum_successes, trials + 1):
        prob = _binomial_probability(trials, single_trial_success_probability, successes)
        total_prob += prob
    
    percentage = total_prob * 100
    
    # Calculate expected number of successes
    expected_successes = trials * single_trial_success_probability
    
    result = f"**Binomial Probability (Independent Trials)**\n\n"
    result += f"- **Number of trials**: {trials}\n"
    result += f"- **Success probability per trial**: {single_trial_success_probability * 100:.1f}%\n"
    result += f"- **Minimum successes desired**: {minimum_successes}\n\n"
    result += f"**Result**: {percentage:.2f}% chance of {minimum_successes}+ successes\n"
    result += f"**Expected successes**: {expected_successes:.1f} out of {trials} trials\n\n"
    
    # Show distribution for small trial counts
    if trials <= 20:
        result += "**Distribution**:\n"
        for s in range(trials + 1):
            prob = _binomial_probability(trials, single_trial_success_probability, s)
            if prob * 100 >= 1.0:  # Only show >= 1%
                result += f"  - Exactly {s}: {prob * 100:.1f}%\n"
    
    return result


# ============================================================================
# TOOL 12: CONSISTENCY ANALYSIS (Variance Focus)
# ============================================================================


@tool
def deck_consistency_analysis(
    deck_size: int,
    cards_in_category: int,
    cards_drawn: int,
    target_minimum: int,
    target_maximum: int
) -> str:
    """
    Analyze deck consistency: how reliably you'll hit your target range.
    
    Focuses on variance, standard deviation, and consistency metrics.
    Best for: "How consistent is my mana base?", "How reliable is this density?"
    
    Args:
        deck_size: Total cards in deck
        cards_in_category: Cards of this type in deck
        cards_drawn: Cards you're analyzing (e.g., opening 7)
        target_minimum: Your ideal minimum (e.g., 2 lands)
        target_maximum: Your ideal maximum (e.g., 4 lands)
        
    Returns:
        Comprehensive consistency analysis with variance and hit rate.
        
    Example:
        "How consistent is 24 lands for hitting 2-4 in opening hand?"
        deck_consistency_analysis(60, 24, 7, 2, 4)
    """
    # Expected value
    expected = (cards_drawn * cards_in_category) / deck_size
    
    # Calculate full distribution
    distribution = []
    max_possible = min(cards_in_category, cards_drawn)
    
    for count in range(0, max_possible + 1):
        prob = _hypergeometric_probability(
            deck_size, cards_in_category, cards_drawn, count
        )
        distribution.append((count, prob))
    
    # Calculate variance and std dev
    variance, std_dev = _calculate_variance(distribution)
    
    # Calculate probability of hitting target range
    target_prob = sum(
        prob for count, prob in distribution 
        if target_minimum <= count <= target_maximum
    )
    
    # Calculate "consistency score" (higher is more consistent)
    # Inverse of coefficient of variation, scaled
    consistency_score = (expected / std_dev) * 10 if std_dev > 0 else 0
    consistency_score = min(consistency_score, 100)  # Cap at 100
    
    result = f"**Deck Consistency Analysis**\n\n"
    result += f"**Configuration**:\n"
    result += f"  - Deck size: {deck_size}\n"
    result += f"  - Cards in category: {cards_in_category}\n"
    result += f"  - Cards drawn: {cards_drawn}\n"
    result += f"  - Target range: {target_minimum}-{target_maximum}\n\n"
    
    result += f"**Statistical Measures**:\n"
    result += f"  - Expected value: {expected:.2f} cards\n"
    result += f"  - Standard deviation: {std_dev:.2f}\n"
    result += f"  - Variance: {variance:.2f}\n"
    result += f"  - Most likely outcome: {max(distribution, key=lambda x: x[1])[0]} cards\n\n"
    
    result += f"**Consistency Metrics**:\n"
    result += f"  - Hit target range: {target_prob * 100:.1f}% of the time\n"
    result += f"  - Consistency score: {consistency_score:.0f}/100\n"
    
    if consistency_score >= 70:
        result += f"  - Rating: ✅ **Highly Consistent**\n"
    elif consistency_score >= 50:
        result += f"  - Rating: ✔️ **Moderately Consistent**\n"
    elif consistency_score >= 30:
        result += f"  - Rating: ⚠️ **Somewhat Variable**\n"
    else:
        result += f"  - Rating: ❌ **Highly Variable**\n"
    
    result += f"\n**Distribution Breakdown**:\n"
    for count, prob in distribution:
        percentage = prob * 100
        if percentage >= 0.5:
            in_range = "✓" if target_minimum <= count <= target_maximum else " "
            bar = "█" * int(percentage / 2)
            result += f"  {in_range} {count}: {percentage:5.1f}% {bar}\n"
    
    result += f"\n**Interpretation**:\n"
    result += f"You'll hit your target range about {target_prob * 100:.0f}% of the time.\n"
    
    if std_dev < 1.0:
        result += f"Low variance ({std_dev:.1f}) means very predictable outcomes.\n"
    elif std_dev < 1.5:
        result += f"Moderate variance ({std_dev:.1f}) means reasonably predictable.\n"
    else:
        result += f"High variance ({std_dev:.1f}) means less predictable outcomes.\n"
    
    return result


# ============================================================================
# TOOL 13-14: ADVANCED COMBO & MULLIGAN TOOLS
# ============================================================================


@tool
def combo_assembly_probability(
    deck_size: int,
    combo_pieces: List[int],
    cards_drawn: int
) -> str:
    """
    Calculate probability of drawing ALL pieces of a combo.
    
    Supports 2-piece combos exactly, 3+ pieces approximately.
    Best for: "Both combo pieces in opening hand?", "All 3 cards by turn 5?"
    
    Args:
        deck_size: Total cards in deck
        combo_pieces: List of counts for each piece [4, 4] or [4, 4, 2]
        cards_drawn: How many cards you're drawing
        
    Returns:
        Probability of assembling the full combo.
        
    Example:
        "What are the odds of having both combo pieces in opening hand?"
        combo_assembly_probability(60, [4, 4], 7)
    """
    if len(combo_pieces) == 0:
        return "❌ Error: Must specify at least one combo piece"
    
    if len(combo_pieces) == 1:
        # Single piece - just need at least 1
        prob = 0.0
        for count in range(1, min(combo_pieces[0], cards_drawn) + 1):
            prob += _hypergeometric_probability(
                deck_size, combo_pieces[0], cards_drawn, count
            )
        percentage = prob * 100
        odds_ratio = 1 / prob if prob > 0 else float('inf')
        
        return (
            f"**Single Combo Piece Probability**\n\n"
            f"- **Copies in deck**: {combo_pieces[0]}\n"
            f"- **Cards drawn**: {cards_drawn}\n\n"
            f"**Result**: {percentage:.2f}% (1 in {odds_ratio:.1f})\n"
        )
    
    if len(combo_pieces) == 2:
        piece1_count, piece2_count = combo_pieces
        
        # Exact calculation for 2-piece combos using multivariate hypergeometric
        total_prob = 0.0
        
        for p1 in range(1, min(piece1_count, cards_drawn) + 1):
            for p2 in range(1, min(piece2_count, cards_drawn - p1) + 1):
                if p1 + p2 <= cards_drawn:
                    other_cards = deck_size - piece1_count - piece2_count
                    remaining_draws = cards_drawn - p1 - p2
                    
                    if remaining_draws >= 0 and other_cards >= remaining_draws:
                        try:
                            prob = (
                                comb(piece1_count, p1) *
                                comb(piece2_count, p2) *
                                comb(other_cards, remaining_draws)
                            ) / comb(deck_size, cards_drawn)
                            
                            total_prob += prob
                        except (ValueError, ZeroDivisionError, OverflowError):
                            pass
        
        percentage = total_prob * 100
        odds_ratio = 1 / total_prob if total_prob > 0 else float('inf')
        
        result = f"**2-Piece Combo Assembly Probability**\n\n"
        result += f"- **Deck size**: {deck_size}\n"
        result += f"- **Piece 1 copies**: {piece1_count}\n"
        result += f"- **Piece 2 copies**: {piece2_count}\n"
        result += f"- **Cards drawn**: {cards_drawn}\n\n"
        result += f"**Result**: {percentage:.2f}% (approximately 1 in {odds_ratio:.1f})\n"
        result += f"\nThis is the probability of drawing at least one of EACH piece.\n"
        
        return result
    
    # For 3+ pieces, use approximation (independent probabilities)
    result = f"**Multi-Piece Combo Assembly (3+ pieces)**\n\n"
    result += f"- **Deck size**: {deck_size}\n"
    result += f"- **Number of pieces**: {len(combo_pieces)}\n"
    result += f"- **Cards drawn**: {cards_drawn}\n\n"
    
    result += "**Individual piece probabilities** (at least 1 of each):\n"
    individual_probs = []
    
    for i, count in enumerate(combo_pieces, 1):
        prob = 0.0
        for drawn in range(1, min(count, cards_drawn) + 1):
            prob += _hypergeometric_probability(deck_size, count, cards_drawn, drawn)
        
        individual_probs.append(prob)
        result += f"  - Piece {i} ({count} copies): {prob * 100:.2f}%\n"
    
    # Conservative approximation: multiply probabilities
    approx_prob = 1.0
    for prob in individual_probs:
        approx_prob *= prob
    
    result += f"\n**Approximate combined probability**: {approx_prob * 100:.2f}%\n"
    result += f"(approximately 1 in {1/approx_prob if approx_prob > 0 else float('inf'):.1f})\n\n"
    result += "*Note: This assumes independence (conservative estimate).*\n"
    
    return result


@tool
def mulligan_probability_analysis(
    deck_size: int,
    cards_in_category: int,
    minimum_acceptable: int,
    maximum_acceptable: int,
    mulligans: int = 2
) -> str:
    """
    Calculate probability of getting an acceptable hand after mulligans (London rule).
    
    Models the London mulligan: draw 7, keep or mulligan to N-1 cards.
    Best for: Mulligan decision analysis, deck consistency.
    
    Args:
        deck_size: Total cards in deck
        cards_in_category: Cards you're counting (e.g., lands)
        minimum_acceptable: Minimum count to keep
        maximum_acceptable: Maximum count to keep
        mulligans: Number of mulligans willing to take (default: 2)
        
    Returns:
        Probability analysis for each mulligan with cumulative success.
        
    Example:
        "Odds of getting 2-4 lands within 2 mulligans?"
        mulligan_probability_analysis(60, 24, 2, 4, 2)
    """
    initial_hand = 7
    results = []
    cumulative_success = 0.0
    
    for mull in range(mulligans + 1):
        hand_size = initial_hand - mull
        
        if hand_size < 1:
            break
        
        # Probability of acceptable hand at THIS hand size
        prob_success = 0.0
        for count in range(minimum_acceptable, maximum_acceptable + 1):
            if count <= hand_size:
                prob_success += _hypergeometric_probability(
                    deck_size, cards_in_category, hand_size, count
                )
        
        # Probability of reaching this mulligan and succeeding
        # P(fail all previous) * P(success this time)
        prob_fail_previous = 1.0
        for prev_mull in range(mull):
            prev_hand_size = initial_hand - prev_mull
            prev_success = 0.0
            for count in range(minimum_acceptable, maximum_acceptable + 1):
                if count <= prev_hand_size:
                    prev_success += _hypergeometric_probability(
                        deck_size, cards_in_category, prev_hand_size, count
                    )
            prob_fail_previous *= (1 - prev_success)
        
        prob_this_mulligan = prob_fail_previous * prob_success
        cumulative_success += prob_this_mulligan
        
        results.append({
            'mulligan': mull,
            'hand_size': hand_size,
            'prob_this': prob_success * 100,
            'cumulative': cumulative_success * 100,
            'prob_reach_and_succeed': prob_this_mulligan * 100
        })
    
    # Format output
    result = f"**London Mulligan Analysis**\n\n"
    result += f"**Configuration**:\n"
    result += f"  - Deck size: {deck_size}\n"
    result += f"  - Cards in category: {cards_in_category}\n"
    result += f"  - Acceptable range: {minimum_acceptable}-{maximum_acceptable}\n"
    result += f"  - Max mulligans: {mulligans}\n\n"
    
    for r in results:
        mull_text = "Opening hand" if r['mulligan'] == 0 else f"Mulligan {r['mulligan']}"
        result += f"**{mull_text}** ({r['hand_size']} cards):\n"
        result += f"  - If you see this hand: {r['prob_this']:.2f}% is acceptable\n"
        result += f"  - Cumulative: {r['cumulative']:.2f}% by this point\n"
        if r['mulligan'] > 0:
            result += f"  - Probability of succeeding here: {r['prob_reach_and_succeed']:.2f}%\n"
        result += "\n"
    
    final_prob = cumulative_success * 100
    odds_ratio = 1 / cumulative_success if cumulative_success > 0 else float('inf')
    
    result += f"**Final Result**: {final_prob:.2f}% chance of acceptable hand\n"
    result += f"within {mulligans} mulligan(s) (1 in {odds_ratio:.1f})\n"
    
    if final_prob >= 95:
        result += "\n✅ **Extremely reliable** - almost always hit your target\n"
    elif final_prob >= 85:
        result += "\n✔️ **Very reliable** - usually hit your target\n"
    elif final_prob >= 70:
        result += "\n➡️ **Fairly reliable** - most games you'll be fine\n"
    else:
        result += "\n⚠️ **Inconsistent** - consider adjusting card counts\n"
    
    return result


@tool
def probability_by_turn(
    deck_size: int,
    cards_in_category: int,
    opening_hand_size: int,
    turn_number: int,
    minimum_count: int
) -> str:
    """
    Calculate probability of drawing at least N cards by a specific turn.
    
    Accounts for opening hand + draws per turn (on play vs on draw).
    Best for: "By turn 4, odds of having a combo piece?", turn-by-turn analysis
    
    Args:
        deck_size: Total cards in deck
        cards_in_category: Cards you're looking for
        opening_hand_size: Initial hand (7, or 6 if mulled)
        turn_number: Which turn (e.g., turn 3)
        minimum_count: Minimum cards needed by that turn
        
    Returns:
        Probability for both "on the play" and "on the draw" scenarios.
        
    Example:
        "By turn 4, odds of drawing at least 1 combo piece?"
        probability_by_turn(60, 8, 7, 4, 1)
    """
    results = []
    
    # Calculate for both scenarios
    for scenario, draws in [("on the play", turn_number - 1), ("on the draw", turn_number)]:
        total_seen = opening_hand_size + draws
        
        if total_seen > deck_size:
            total_seen = deck_size
        
        # Calculate probability of minimum_count or more
        prob = 0.0
        max_possible = min(cards_in_category, total_seen)
        
        for count in range(minimum_count, max_possible + 1):
            prob += _hypergeometric_probability(
                deck_size, cards_in_category, total_seen, count
            )
        
        results.append({
            'scenario': scenario,
            'cards_seen': total_seen,
            'probability': prob * 100,
            'odds_ratio': 1 / prob if prob > 0 else float('inf')
        })
    
    # Format output
    result = f"**Probability by Turn {turn_number}**\n\n"
    result += f"- **Deck size**: {deck_size}\n"
    result += f"- **Cards in category**: {cards_in_category}\n"
    result += f"- **Opening hand size**: {opening_hand_size}\n"
    result += f"- **Target**: At least {minimum_count} by turn {turn_number}\n\n"
    
    for r in results:
        result += f"**{r['scenario'].title()}** ({r['cards_seen']} cards seen):\n"
        result += f"  - Probability: {r['probability']:.2f}%\n"
        result += f"  - Odds: ~1 in {r['odds_ratio']:.1f}\n\n"
    
    return result


# ============================================================================
# EXPORT ALL TOOLS
# ============================================================================


STATISTICS_TOOLS = [
    # Hypergeometric (basic drawing)
    probability_of_drawing_exactly,
    probability_of_drawing_at_least,
    probability_of_drawing_at_most,
    probability_of_drawing_range,
    
    # Conditional probability (after seeing cards)
    conditional_probability_after_seeing,
    probability_after_partial_information,
    
    # Expected value & distribution
    expected_count_and_distribution,
    expected_value_weighted,
    
    # Geometric & negative binomial (until success)
    expected_draws_until_first,
    expected_draws_until_nth,
    
    # Binomial (independent trials)
    probability_across_independent_trials,
    
    # Consistency analysis
    deck_consistency_analysis,
    
    # Advanced combo & mulligan
    combo_assembly_probability,
    mulligan_probability_analysis,
    probability_by_turn,
]
