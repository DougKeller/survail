ROLE_DEFINITIONS: dict[str, str] = {
    "land": (
        "A card that occupies a land slot. Applies only when the type line includes Land, "
        "including modal double-faced cards with a land face; treat those land faces as lands "
        "first and spells second."
    ),
    "mana_ramp": (
        "Repeatable acceleration ahead of the natural one-land-per-turn progression: mana "
        "dorks, mana rocks, spells that put extra lands onto the battlefield, extra land "
        "drops, and broad cost reduction. Lands themselves — including fetch lands — are "
        "not ramp, tutors that find cards without producing mana are not ramp, and "
        "one-shot burst mana such as Dark Ritual or Jeska's Will is not ramp; classify "
        "burst mana as an enabler only when the plan is built around one big turn."
    ),
    "card_advantage": (
        "An effect that nets more than one card of real access from the single card spent: "
        "multi-card draw, repeatable draw engines, impulse draw (exile and may play), "
        "recurring land fetch like Land Tax, and self-mill only in decks that reliably play "
        "cards from the graveyard. Count repeatable effects cumulatively: a card that draws "
        "or returns a card on each of several triggers or turns (Life from the Loam, "
        "landfall draw) nets cards over a game and qualifies. A single effect that merely "
        "replaces itself (cantrips, Mind Stone) or one-shot one-for-one recursion (Regrowth, "
        "Eternal Witness) is card_selection, not card advantage; loot effects that leave you "
        "net down are not card advantage; creating tokens or board material is not card "
        "advantage; conditional draw doublers are enhancers, not card advantage."
    ),
    "card_selection": (
        "Filtering, smoothing, or tutoring that improves card quality without netting extra "
        "cards: scry, surveil, cantrips, top-of-library manipulation, tutors that trade one "
        "card for a specific card, and one-for-one recursion that retrieves a chosen card. "
        "Ordinary fetch lands and mana fixing are not card selection."
    ),
    "targeted_disruption": (
        "Spending one card to answer one of an opponent's cards or plays: spot removal, "
        "counterspells, bounce, taps and freezes, targeted graveyard exile, or single-land "
        "disruption. An effect that can answer many cards at once — a scalable or global "
        "sweep — is mass_disruption, not targeted_disruption, even when it is sometimes "
        "aimed at a single threat. Protecting your own cards is not disruption; that "
        "belongs to the enabler role."
    ),
    "mass_disruption": (
        "One card that sets back many opponent cards or whole turns at once: board wipes, "
        "mass artifact or enchantment removal, mass graveyard exile, fogs, Propaganda-style "
        "attack taxes, stax or silence pieces, and full-turn negation such as Teferi's "
        "Protection. Rule of thumb: after it resolves you sit at card parity or better "
        "against the table; a one-for-one trade is targeted_disruption instead."
    ),
    "enabler": (
        "A card that does plan-specific work the deck's core plan cannot function without: "
        "creating, fueling, or assembling the plan, recursion that rebuilds it, and "
        "protection (hexproof, indestructible, regeneration, haste, flash) that keeps key "
        "pieces alive. Apply the staple test before marking this role: if the card would "
        "contribute the same way in any deck of these colors — any land whose contribution "
        "is producing or fixing mana (basics, fetches, duals), a generic mana rock like "
        "Sol Ring, generic removal or card draw — it is NOT an enabler here, even when the "
        "plan uses lands, mana, or the graveyard."
    ),
    "payoff": (
        "A card that rewards the plan once it is happening, cashing the assembled plan in "
        "for damage, cards, mana, board presence, or the win. A payoff does not advance the "
        "plan by itself."
    ),
    "enhancer": (
        "A force multiplier that only improves a plan already in motion and does nothing on "
        "its own: token, damage, trigger, or draw doublers and similar amplifiers. Doing "
        "twice as much of zero is still zero, so weigh its standalone floor honestly."
    ),
}

ROLE_RUBRICS: dict[str, dict[str, str]] = {
    "land": {
        "mana_reliability": (
            "How reliably does it produce the colors this deck's commander, core cards, and "
            "strategy require?"
        ),
        "tempo_efficiency": (
            "How little tempo loss does it impose through entering tapped, sequencing "
            "constraints, activation costs, or conditional mana?"
        ),
        "utility": "How valuable is its non-mana utility to this deck's plan or common game states?",
        "opportunity_cost": (
            "How reasonable is its slot cost compared with a basic land, stronger fixing land, "
            "or more broadly useful utility land?"
        ),
        "resilience": "How durable or difficult to disrupt is its mana or utility contribution?",
    },
    "mana_ramp": {
        "speed": "How early does it come down and start accelerating the deck's mana?",
        "permanence": (
            "How repeatable and permanent is the acceleration across future turns, as opposed "
            "to a one-shot burst?"
        ),
        "efficiency": (
            "How favorable is the mana, card, and tempo investment compared with the "
            "acceleration gained?"
        ),
        "fixing": "How well does it produce, find, or enable the colors this deck needs?",
        "curve_fit": (
            "How well does the acceleration line up with the commander's cost and the deck's "
            "key turns?"
        ),
    },
    "card_advantage": {
        "net_gain": (
            "How many extra cards of real access does it net beyond the one card spent to "
            "cast it?"
        ),
        "repeatability": "How often does it keep producing extra cards across a typical game?",
        "reliability": (
            "How consistently can this deck meet the conditions it needs to generate the "
            "extra cards?"
        ),
        "quality": "How relevant and playable are the cards or resources it provides?",
        "floor": (
            "How useful is the card when the deck's ideal engine or synergy pieces are not assembled?"
        ),
    },
    "card_selection": {
        "access": "How directly does it find, filter toward, or select the cards this deck wants?",
        "efficiency": (
            "How favorable is the mana, timing, and card investment for the selection provided?"
        ),
        "range": "How broad and relevant is the set of cards it can find or dig through?",
        "setup_value": (
            "How well does it assemble the deck's key engines, answers, payoffs, or missing "
            "lands?"
        ),
        "timing": (
            "How well does the effect fit the stage of the game when this deck wants card "
            "selection or tutoring?"
        ),
    },
    "targeted_disruption": {
        "efficiency": "How mana-efficient is the answer relative to the threats it trades with?",
        "coverage": (
            "How broad is the range of threats it can answer across permanent types, spells "
            "on the stack, graveyards, and lands?"
        ),
        "permanence": (
            "How cleanly and durably does it answer the threat, favoring exile or destruction "
            "over bounce or temporary taps?"
        ),
        "timing": (
            "How well can it be held up and used at the moment this deck needs it, ideally at "
            "instant speed?"
        ),
        "flexibility": (
            "How useful is the card across different matchups, board states, or threat profiles?"
        ),
    },
    "mass_disruption": {
        "impact": (
            "How strongly does it set back multiple opponents' boards, plans, or turns at once?"
        ),
        "asymmetry": (
            "How well does it leave this deck at parity or ahead, sparing or advancing its own "
            "plan while disrupting the table?"
        ),
        "coverage": (
            "How well does it answer the permanent types or attack angles this deck is "
            "otherwise soft to?"
        ),
        "recoverability": "How well can this deck rebuild, recur, or benefit after the effect resolves?",
        "timing": (
            "How well does it line up with the turns when this deck needs a reset, a stall, or "
            "containment?"
        ),
    },
    "enabler": {
        "directness": "How directly does it create, fuel, or unlock the deck's core plan?",
        "reliability": "How consistently can this deck deploy it and have it matter?",
        "resilience": (
            "How well does it protect, recur, or rebuild the plan against removal and "
            "disruption?"
        ),
        "timing": "How well does it come online before or as the deck wants to start its plan?",
        "breadth": "How many of the deck's important cards, zones, mechanics, or lines does it enable?",
    },
    "payoff": {
        "reward_size": "How large is the reward when the deck executes its core plan?",
        "decisiveness": (
            "How strongly does it convert plan activity into a win, inevitability, lethal "
            "pressure, or overwhelming advantage?"
        ),
        "attainability": "How reliably can this deck turn the payoff on?",
        "conversion": (
            "How efficiently does it convert setup into damage, board presence, cards, mana, "
            "disruption, or another decisive resource?"
        ),
    },
    "enhancer": {
        "amplification": (
            "How strongly does it multiply the output, efficiency, or consistency of the "
            "deck's plan once the plan is running?"
        ),
        "breadth": (
            "How many of the deck's relevant cards, triggers, loops, or repeated actions does "
            "it improve?"
        ),
        "standalone_floor": (
            "How useful is the card when the plan is not yet assembled or has just been "
            "disrupted?"
        ),
        "necessity": (
            "How much does the deck actually need this multiplier to close games, rather than "
            "it being win-more?"
        ),
    },
}

ROLE_NAMES = tuple(ROLE_RUBRICS)

# Each role's defining criterion: when the judge rates it low or very_low, the card is
# not materially performing the role and the whole role is dropped from the evaluation.
ROLE_GATE_CRITERIA: dict[str, str] = {
    "mana_ramp": "permanence",
    "card_advantage": "net_gain",
    "card_selection": "access",
    "mass_disruption": "impact",
    "enabler": "directness",
    "payoff": "reward_size",
    "enhancer": "amplification",
}
