import json

from survail.domain.decks import deck_validation_summary
from survail.domain.format_strategies import FormatRules, strategy_for
from survail.models import CardSet, Deck
from survail.schemas import CardFace, ScryfallCardSnapshot


def deck_description_context(deck: Deck) -> str:
    strategy = strategy_for(deck.format)
    sections = [
        "Goal / North Star",
        deck.goal or "None supplied",
        "",
        "Format",
        f"Name: {deck.format.value.title()}",
        _format_rules(strategy.rules),
        "",
        "Format deckbuilding fundamentals (advisory, not rubric criteria)",
        "\n".join(f"- {item}" for item in strategy.deckbuilding_fundamentals()),
        "",
        "Current validation",
        json.dumps(deck_validation_summary(deck), indent=2),
        "",
        "Cards",
    ]
    sections.extend(_cardset_context(cardset) for cardset in deck.cardsets)
    return "\n".join(sections)


def _format_rules(rules: FormatRules) -> str:
    details = [
        _size_rule(rules),
        f"Default maximum copies of one card: {rules.max_copies}",
        f"Maximum sideboard cards: {rules.max_sideboard}",
    ]
    if rules.commander_max:
        details.append(f"Commanders required: {rules.commander_min} to {rules.commander_max}")
    else:
        details.append("Commanders: not used")
    return "\n".join(details)


def _size_rule(rules: FormatRules) -> str:
    if rules.exact_size is not None:
        return f"Deck size: exactly {rules.exact_size} cards"
    if rules.minimum_size is not None:
        return f"Deck size: at least {rules.minimum_size} cards"
    return "Deck size: unrestricted"


def _cardset_context(cardset: CardSet) -> str:
    card = ScryfallCardSnapshot.model_validate(cardset.scryfall, strict=False)
    header = f"\n[{cardset.zone.value.title()}] {cardset.quantity}x {card.name}"
    if card.card_faces:
        details = "\n\n".join(_face_context(face) for face in card.card_faces)
        return f"{header}\n{details}"
    return "\n".join(
        [
            header,
            f"Mana cost: {card.mana_cost or 'None'}",
            f"Type: {card.type_line}",
            f"Oracle text: {(card.oracle_text or 'None').strip()}",
        ]
    )


def _face_context(face: CardFace) -> str:
    return "\n".join(
        [
            f"Face: {face.name}",
            f"Mana cost: {face.mana_cost or 'None'}",
            f"Type: {face.type_line}",
            f"Oracle text: {(face.oracle_text or 'None').strip()}",
        ]
    )
