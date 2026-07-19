ROLE_DEFINITIONS: dict[str, str] = {
    "land": (
        "A card that occupies a land slot. Applies only when the type line includes Land, "
        "including modal double-faced cards with a land face; treat those land faces as lands "
        "first and spells second. A land's non-mana abilities also earn the matching spell "
        "roles alongside land: graveyard exile is mass_disruption, a channel removal "
        "mode is targeted_disruption, and a surveil or scry ability on a land is "
        "card_selection for a deck that uses the graveyard."
    ),
    "mana_ramp": (
        "Anything that gives you more available mana than the natural one-land-per-turn "
        "progression, whether once or repeatedly. This plainly includes mana dorks and "
        "rocks, ramp spells that put a land onto the battlefield, reliable extra land "
        "drops, and broad cost reduction — mark mana_ramp "
        "applicable for these without hesitation. A one-shot ramp spell still counts, "
        "because the land or mana source it leaves is permanent. Count repeatable engines "
        "cumulatively: a permanent whose trigger returns lands to the battlefield or "
        "makes resource tokens each turn is ramp over a game. Exclusions: an extra land "
        "play that only offsets a land you sacrifice each turn nets zero acceleration; "
        "lands themselves, "
        "including fetch lands; tutors that find cards without producing mana; and "
        "one-shot burst mana, which is an enabler only when the plan is "
        "built around one big turn."
    ),
    "card_advantage": (
        "An effect that nets more than one card of real access from the single card spent: "
        "multi-card draw, repeatable draw engines, impulse draw (exile and may play), "
        "recurring land fetch, a spell that mills or digs and still ends with two or more "
        "cards in your hand, repeatably playing or copying real cards out of any graveyard "
        "— yours or an opponent's — and self-mill only in decks that reliably play "
        "cards from the graveyard. Count only what you hold at once: a permanent that "
        "draws or retrieves a card as it arrives nets a card — you keep both the body and "
        "the card — and is card advantage, while an "
        "effect that only replaces its own card later, when it dies or is cashed in "
        "(such as a dies-draw creature or a permanent sacrificed to draw), nets nothing at "
        "any moment and earns no draw "
        "role at all; count that replacement toward the floor or resilience of the card's "
        "real roles instead. Count repeatable effects cumulatively: a card that draws or "
        "returns a card on each of several triggers or turns nets cards over a game and "
        "qualifies. Reanimation and one-shot chosen retrieval that trade the whole spell "
        "for a single card or creature never give you both at once and are card_selection, "
        "not card advantage; "
        "cantrips that replace themselves are card_selection; loot effects that leave you "
        "net down are not card advantage; creating tokens or board material is never card "
        "advantage — tokens are not cards; conditional draw doublers are enhancers, not "
        "card advantage."
    ),
    "card_selection": (
        "Filtering, smoothing, or tutoring that improves card quality without netting extra "
        "cards: scry, surveil, cantrips, top-of-library manipulation, tutors that trade one "
        "card for a specific card, and one-shot chosen retrieval or reanimation that trades "
        "the spell for a chosen card in any zone, including mill-then-return-one effects. "
        "A permanent that retrieves a card as it arrives keeps both body and card "
        "and belongs to card_advantage instead. Ordinary fetch lands and mana fixing are "
        "not card selection."
    ),
    "targeted_disruption": (
        "Spending one card for a one-for-one trade against an opponent's card or play: "
        "spot removal, stack interaction, bounce, taps and freezes, targeted graveyard exile, "
        "or single-land disruption. An effect that reaches the whole table at once — a "
        "scalable or global sweep, or a spell that takes a permanent, card, or resource "
        "from each opponent — is mass_disruption instead, as is one that empties a whole "
        "zone such as a graveyard or a hand in a single shot. Answering one thing at a "
        "time keeps a card in this role even when it repeats: a recurring trigger that "
        "disrupts a single opponent every turn or attack is an outstanding "
        "targeted_disruption piece, not mass_disruption, because the rest of the table is "
        "untouched. Protecting your own cards is not disruption; that belongs to the "
        "enabler role."
    ),
    "mass_disruption": (
        "One card that answers many cards at once, or that answers something from every "
        "opponent at the same time: board wipes and other resets that clear a permanent "
        "type across the table, mass artifact or enchantment removal, graveyard exile, "
        "effects that make each opponent sacrifice or discard, fogs, attack taxes, stax "
        "or silence pieces, and full-turn lockouts that stop the table from acting. Apply "
        "the table-parity test: after the card resolves, are you level with the whole "
        "table, or still behind at least one player? A spell that takes a permanent or "
        "card from each opponent trades your one card for several of theirs and reaches "
        "parity, so it belongs here even though it never removes more than one thing per "
        "player. An effect that empties a whole zone or resource pool in one shot — "
        "exiling an entire graveyard, emptying a hand — also belongs here even when it "
        "hits a single player, because it answers many cards simultaneously and undoes "
        "setup that player spent several cards building. What keeps a card out of this "
        "role is answering one thing at a time: a spell or ability pointed at a single "
        "permanent, spell, or card leaves the rest of the table untouched and is "
        "targeted_disruption. Repeatability does not change that: a permanent whose "
        "trigger or activated ability disrupts again every turn is an elite repeatable "
        "engine, but when each use answers one thing from one opponent it stays "
        "targeted_disruption and rates as a strong example of that role. An effect that "
        "only shields your own permanents or plan — even from a board wipe — is the "
        "enabler role, never disruption of any kind."
    ),
    "enabler": (
        "A card that does plan-specific work the deck's core plan cannot function without: "
        "creating, fueling, or assembling the plan, recursion that rebuilds it, and "
        "protection (hexproof, indestructible, regeneration, haste, flash) that keeps key "
        "pieces alive. Protection means shielding your own cards; removing or answering "
        "opponents' cards is disruption, never enabler work, even when doing so protects "
        "the plan indirectly — score that mode once, as disruption. Apply the staple "
        "test before marking this role: if the card would "
        "contribute the same way in any deck of these colors — any land whose only "
        "contribution is producing or fixing mana (basics, fetches, duals), a generic "
        "mana rock, generic ramp spells and mana dorks, one-shot burst "
        "mana, generic removal, or generic card draw and filtering — it is NOT an "
        "enabler here, even when the plan uses lands, mana, or the graveyard. A land "
        "whose non-mana ability does plan-specific work (a surveil land feeding a "
        "graveyard plan) passes the staple test on that ability. A synergy that every "
        "card of its class provides equally (every land or ramp spell triggers "
        "landfall, every draw spell fills the graveyard) does not make a staple an "
        "enabler."
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
        "utility": (
            "How valuable is its non-mana utility to this deck's plan or common game "
            "states? A land ability the plan actively uses (surveil into a graveyard "
            "deck, recursion, protection) rates high or very_high."
        ),
        "opportunity_cost": (
            "How reasonable is its slot cost compared with a basic land, stronger fixing land, "
            "or more broadly useful utility land?"
        ),
        "resilience": "How durable or difficult to disrupt is its mana or utility contribution?",
    },
    "mana_ramp": {
        "speed": "How early does it come down and start accelerating the deck's mana?",
        "permanence": (
            "How lasting is the acceleration it leaves behind? Judge the mana it leaves, "
            "not whether the spell was cast once: a land put onto the battlefield or a "
            "permanent mana source is high or very_high even when a one-shot spell created "
            "it (a spell that puts a land onto the battlefield leaves permanent mana and "
            "therefore rates high). Only genuinely one-shot mana that is gone the same "
            "turn (a ritual) is low or very_low."
        ),
        "efficiency": (
            "How favorable is the mana, card, and tempo investment compared with the "
            "acceleration gained?"
        ),
        "fixing": (
            "How well does its mana output fit this deck's actual color requirements? "
            "Judge color hunger from the commander's colored pips and the deck's colored "
            "costs: colorless output that cannot help cast a heavily-pipped commander "
            "rates low in that deck, while in a deck with modest color needs colorless "
            "acceleration is neutral. Perfect fixing for the deck's colors is very_high."
        ),
        "curve_fit": (
            "How well does the acceleration line up with the commander's cost and the deck's "
            "key turns?"
        ),
    },
    "card_advantage": {
        "net_gain": (
            "How many extra cards of real access does it net beyond the one card spent to "
            "cast it? Count everything you hold at once: a permanent that draws or "
            "retrieves a card as it arrives nets that card, because you keep both the "
            "body and the card."
        ),
        "repeatability": "How often does it keep producing extra cards across a typical game?",
        "reliability": (
            "How consistently can this deck meet the conditions it needs to generate the "
            "extra cards?"
        ),
        "quality": "How relevant and playable are the cards or resources it provides?",
        "floor": (
            "How useful is the card when the deck's ideal engine or synergy pieces are "
            "not assembled?"
        ),
    },
    "card_selection": {
        "access": (
            "How directly does it let this deck choose, filter, or order the cards it "
            "draws or finds? Rate very_low for raw draw with no choice, filtering, or "
            "ordering — drawing extra cards without selecting is card_advantage, not "
            "selection."
        ),
        "efficiency": (
            "How favorable is the mana, timing, and card investment for the selection provided?"
        ),
        "range": "How broad and relevant is the set of cards it can find or dig through?",
        "setup_value": (
            "How well does it assemble the deck's key engines, answers, payoffs, or missing lands?"
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
            "How well does the disruption fall on opponents rather than on this deck, "
            "leaving it level with the whole table rather than behind any one player? "
            "An effect that only shields this deck's own board disrupts nobody and does "
            "not belong to this role at all."
        ),
        "coverage": (
            "How well does it answer the permanent types or attack angles this deck is "
            "otherwise soft to?"
        ),
        "recoverability": (
            "How well can this deck rebuild, recur, or benefit after the effect resolves?"
        ),
        "timing": (
            "How well does it line up with the turns when this deck needs a reset, a stall, or "
            "containment?"
        ),
    },
    "enabler": {
        "directness": (
            "How directly does it do plan-specific work that a generic staple of these "
            "colors would not do? Rate very_low — regardless of how much the plan uses "
            "lands, mana, or interaction — if the card would contribute identically in any "
            "deck of these colors: basic and fetch lands, generic mana rocks, ramp spells, "
            "mana dorks, burst mana, generic removal or countermagic, generic card draw or "
            "filtering. A synergy that every card of its class provides equally (every "
            "land or ramp spell triggers landfall) does not count as plan-specific work, "
            "and a goal that asks for interaction or protection does not make generic "
            "interaction plan-specific."
        ),
        "reliability": "How consistently can this deck deploy it and have it matter?",
        "resilience": (
            "How well does it protect, recur, or rebuild the plan against removal and disruption?"
        ),
        "timing": "How well does it come online before or as the deck wants to start its plan?",
        "breadth": (
            "How many of the deck's important cards, zones, mechanics, or lines does it enable?"
        ),
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
            "How useful is the card when the plan is not yet assembled or has just been disrupted?"
        ),
        "necessity": (
            "How much does the deck actually need this multiplier to close games, rather than "
            "it being win-more?"
        ),
    },
}
ROLE_NAMES = tuple(ROLE_RUBRICS)
