import json
from collections.abc import Sequence

from survail.core.models import CardSet, Deck
from survail.core.schemas import ScryfallCardSnapshot
from survail.modules.decks.service.formats import FormatRules, strategy_for
from survail.modules.decks.service.validate import deck_validation_summary


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
    snapshot = snapshot_from_cardsets([cardset])
    card_name = snapshot.name if snapshot else cardset.card_name
    header = f"\n[{cardset.zone.value.title()}] {cardset.quantity}x {card_name}"
    details = format_cardset_group_for_llm([cardset]).splitlines()[2:]
    return "\n".join([header, *details])


def format_cardset_group_for_llm(cardsets: Sequence[CardSet]) -> str:
    snapshot = snapshot_from_cardsets(cardsets)
    if snapshot is None:
        return "\n".join(
            [
                "Name: Unknown",
                "Quantity: 0",
                "Zone Summary: None",
                "Mana cost: None",
                "Type: Unknown",
                "Power/Toughness: None",
                "Oracle Text: None",
                "Cardset Notes: None",
            ]
        )
    placements = [
        _cardset_placement_line(cardset)
        for cardset in sorted(cardsets, key=lambda item: (item.zone.value, item.card_name, item.id))
    ]
    notes = [
        _cardset_note_line(cardset)
        for cardset in sorted(cardsets, key=lambda item: (item.zone.value, item.card_name, item.id))
        if (cardset.note or "").strip()
    ]
    return "\n".join(
        [
            f"Name: {snapshot.name}",
            f"Quantity: {sum(cardset.quantity for cardset in cardsets)}",
            "Zone Summary:",
            *(placements or ["- None"]),
            f"Mana cost: {snapshot.mana_cost or 'None'}",
            f"Type: {snapshot.type_line}",
            f"Power/Toughness: {power_toughness_for_llm(snapshot)}",
            f"Oracle Text: {oracle_text_for_llm(snapshot)}",
            "Cardset Notes:",
            *(notes or ["- None"]),
        ]
    )


def snapshot_from_cardsets(cardsets: Sequence[CardSet]) -> ScryfallCardSnapshot | None:
    if not cardsets:
        return None
    return ScryfallCardSnapshot.model_validate(cardsets[0].scryfall, strict=False)


def power_toughness_for_llm(snapshot: ScryfallCardSnapshot) -> str:
    if "Creature" in snapshot.type_line and snapshot.power and snapshot.toughness:
        return f"{snapshot.power}/{snapshot.toughness}"
    face_stats = [
        f"{face.name}: {face.power}/{face.toughness}"
        for face in snapshot.card_faces
        if "Creature" in face.type_line and face.power and face.toughness
    ]
    return "; ".join(face_stats) if face_stats else "None"


def oracle_text_for_llm(snapshot: ScryfallCardSnapshot) -> str:
    if snapshot.oracle_text and snapshot.oracle_text.strip():
        return snapshot.oracle_text.strip()
    face_text = [
        "\n".join(
            [
                f"{face.name} ({face.type_line})",
                (face.oracle_text or "None").strip() or "None",
            ]
        )
        for face in snapshot.card_faces
    ]
    return "\n\n".join(face_text) if face_text else "None"


def _cardset_placement_line(cardset: CardSet) -> str:
    return f"- {cardset.zone.value.title()}: {cardset.quantity}x"


def _cardset_note_line(cardset: CardSet) -> str:
    return f"- {cardset.zone.value.title()}: {(cardset.note or '').strip()}"
