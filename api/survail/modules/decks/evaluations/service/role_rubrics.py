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
        "speed": "How early does it accelerate the deck's mana development?",
        "efficiency": (
            "How favorable is the mana, card, and tempo investment compared with the "
            "acceleration gained?"
        ),
        "fixing": "How well does it produce, find, or enable the colors this deck needs?",
        "reliability": (
            "How consistently can this deck use the ramp effect under normal gameplay conditions?"
        ),
        "synergy": (
            "How meaningfully does the ramp effect interact with the commander, core cards, "
            "card types, zones, or mechanics this deck already wants?"
        ),
    },
    "card_advantage": {
        "efficiency": "How efficiently does it generate extra cards, resources, or repeatable access?",
        "reliability": (
            "How consistently can this deck satisfy the conditions required to gain value from it?"
        ),
        "card_quality": "How relevant, selectable, or usable are the cards or resources it provides?",
        "repeatability": "How often can the deck benefit from the effect across a typical game?",
        "floor": (
            "How useful is the card when the deck's ideal engine or synergy pieces are not assembled?"
        ),
    },
    "selection_tutor": {
        "access": "How directly does it find, filter toward, or select the cards this deck wants?",
        "efficiency": (
            "How favorable is the mana, timing, and card investment for the access provided?"
        ),
        "range": "How broad and relevant is the set of cards it can find or select?",
        "setup_value": (
            "How well does it assemble the deck's key engines, answers, payoffs, or missing "
            "resources?"
        ),
        "timing": (
            "How well does the effect fit the stage of the game when this deck wants card "
            "selection or tutoring?"
        ),
    },
    "interaction": {
        "efficiency": "How mana-efficient and easy to deploy is this answer?",
        "coverage": "How broad and relevant is the range of threats it answers?",
        "permanence": "How cleanly and durably does it answer the threat?",
        "timing": "How well can it be used at the moment this deck needs interaction?",
        "flexibility": (
            "How useful is the card across different matchups, board states, or threat profiles?"
        ),
    },
    "board_control": {
        "reset_power": "How effectively does it reset, contain, or rebalance the relevant board state?",
        "asymmetry": "How well does it preserve, spare, or advance this deck's own plan?",
        "coverage": (
            "How well does it answer the permanent types or board states this deck is likely to "
            "struggle with?"
        ),
        "recoverability": "How well can this deck rebuild, recur, or benefit after the effect resolves?",
        "timing": (
            "How well does the effect line up with the stage of the game when this deck wants a "
            "reset or containment tool?"
        ),
    },
    "protection": {
        "coverage": (
            "How many relevant threats, removal types, disruption types, or failure modes does it "
            "protect against?"
        ),
        "efficiency": (
            "How easy is it to hold up, deploy, or sequence without disrupting the deck's plan?"
        ),
        "reliability": (
            "How consistently does it protect the cards, engines, or board states that matter?"
        ),
        "secondary_value": "How useful is the card when protection is not immediately needed?",
        "scope": (
            "How well does it protect the right amount of the deck's plan, from a single key "
            "piece to the full board?"
        ),
    },
    "engine_enabler": {
        "directness": "How directly does it create, fuel, or unlock the deck's core engine?",
        "reliability": "How consistently can this deck access and use the enabling effect?",
        "synergy_density": "How many important cards, zones, mechanics, or lines does it enable?",
        "timing": "How well does it come online before or as the deck wants to start its engine?",
    },
    "engine_support": {
        "amplification": (
            "How strongly does it increase the output, efficiency, resilience, or consistency of "
            "the deck's engine?"
        ),
        "coverage": (
            "How many relevant engine pieces, triggers, loops, or repeated actions does it improve?"
        ),
        "reliability": (
            "How consistently does it improve an engine that this deck can realistically assemble?"
        ),
        "floor": "How useful is it when the main engine is only partially assembled?",
    },
    "payoff": {
        "reward_size": "How large is the reward when the deck executes its core plan?",
        "decisiveness": (
            "How strongly does it convert engine activity into a win, inevitability, lethal "
            "pressure, or overwhelming advantage?"
        ),
        "attainability": "How reliably can this deck turn the payoff on?",
        "conversion": (
            "How efficiently does it convert setup into damage, board presence, cards, mana, "
            "disruption, or another decisive resource?"
        ),
    },
}

ROLE_NAMES = tuple(ROLE_RUBRICS)
