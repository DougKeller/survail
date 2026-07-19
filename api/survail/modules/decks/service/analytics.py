from collections.abc import Mapping, Sequence
from typing import Protocol

from survail.core.models import CardSet, Deck
from survail.core.schemas import ScryfallCardSnapshot

ANALYTICS_ZONES = frozenset({"mainboard", "commander"})
CARD_TYPE_LABELS = (
    "Creature",
    "Land",
    "Instant",
    "Sorcery",
    "Artifact",
    "Enchantment",
    "Planeswalker",
    "Battle",
)
COLOR_LABELS = {
    "W": "White",
    "U": "Blue",
    "B": "Black",
    "R": "Red",
    "G": "Green",
    "C": "Colorless",
}


class RoleEvaluationLike(Protocol):
    @property
    def oracle_id(self) -> str: ...

    @property
    def roles(self) -> Sequence["RoleLike"]: ...


class RoleLike(Protocol):
    @property
    def role(self) -> str: ...


def scoped_cardsets(
    deck: Deck,
    *,
    exclude_oracle_id: str | None = None,
) -> list[CardSet]:
    relevant = [
        cardset
        for cardset in deck.cardsets
        if cardset.zone.value in ANALYTICS_ZONES and cardset.oracle_id != exclude_oracle_id
    ]
    return sorted(relevant, key=lambda cardset: (cardset.zone.value, cardset.card_name, cardset.id))


def nonland_scoped_cardsets(
    deck: Deck,
    *,
    exclude_oracle_id: str | None = None,
) -> list[CardSet]:
    return [
        cardset
        for cardset in scoped_cardsets(deck, exclude_oracle_id=exclude_oracle_id)
        if not is_land(snapshot(cardset))
    ]


def snapshot(cardset: CardSet) -> ScryfallCardSnapshot:
    return ScryfallCardSnapshot.model_validate(cardset.scryfall, strict=False)


def is_land(card: ScryfallCardSnapshot) -> bool:
    return any("Land" in type_line for type_line in type_lines(card))


def mana_curve_counts(deck: Deck, *, exclude_oracle_id: str | None = None) -> dict[str, int]:
    counts: dict[str, int] = {}
    for cardset in nonland_scoped_cardsets(deck, exclude_oracle_id=exclude_oracle_id):
        cost = format_mana_value(snapshot(cardset).cmc)
        counts[cost] = counts.get(cost, 0) + cardset.quantity
    return counts


def color_pip_counts(deck: Deck, *, exclude_oracle_id: str | None = None) -> dict[str, int]:
    counts = dict.fromkeys(COLOR_LABELS, 0)
    for cardset in nonland_scoped_cardsets(deck, exclude_oracle_id=exclude_oracle_id):
        for color, quantity in mana_cost_pips(snapshot(cardset)).items():
            counts[color] += quantity * cardset.quantity
    return {color: quantity for color, quantity in counts.items() if quantity > 0}


def type_distribution_counts(deck: Deck, *, exclude_oracle_id: str | None = None) -> dict[str, int]:
    counts: dict[str, int] = {}
    for cardset in scoped_cardsets(deck, exclude_oracle_id=exclude_oracle_id):
        for label in type_labels(snapshot(cardset)):
            counts[label] = counts.get(label, 0) + cardset.quantity
    return counts


def tag_distribution_counts(
    deck: Deck,
    *,
    exclude_oracle_id: str | None = None,
) -> dict[str, float]:
    counts: dict[str, float] = {}
    for cardset in scoped_cardsets(deck, exclude_oracle_id=exclude_oracle_id):
        if not cardset.tag_links:
            counts["untagged"] = counts.get("untagged", 0) + cardset.quantity
            continue
        for link in cardset.tag_links:
            key = str(link.deck_tag.id)
            counts[key] = counts.get(key, 0) + cardset.quantity * link.weight
    return counts


def role_distribution_counts(
    deck: Deck,
    evaluations: Sequence[RoleEvaluationLike],
    *,
    exclude_oracle_id: str | None = None,
) -> dict[str, int]:
    quantity_by_oracle: dict[str, int] = {}
    for cardset in scoped_cardsets(deck, exclude_oracle_id=exclude_oracle_id):
        quantity_by_oracle[cardset.oracle_id] = (
            quantity_by_oracle.get(cardset.oracle_id, 0) + cardset.quantity
        )
    counts: dict[str, int] = {}
    for evaluation in evaluations:
        quantity = quantity_by_oracle.get(evaluation.oracle_id)
        if quantity is None:
            continue
        for role in evaluation.roles:
            counts[role.role] = counts.get(role.role, 0) + quantity
    return counts


def scoped_unique_oracle_ids(deck: Deck, *, exclude_oracle_id: str | None = None) -> list[str]:
    return list(
        dict.fromkeys(
            cardset.oracle_id
            for cardset in scoped_cardsets(deck, exclude_oracle_id=exclude_oracle_id)
        )
    )


def scoped_card_name_map(deck: Deck, *, exclude_oracle_id: str | None = None) -> dict[str, str]:
    return {
        cardset.oracle_id: cardset.card_name
        for cardset in scoped_cardsets(deck, exclude_oracle_id=exclude_oracle_id)
    }


def total_cards(deck: Deck, *, exclude_oracle_id: str | None = None) -> int:
    return sum(
        cardset.quantity for cardset in scoped_cardsets(deck, exclude_oracle_id=exclude_oracle_id)
    )


def nonland_total_cards(deck: Deck, *, exclude_oracle_id: str | None = None) -> int:
    return sum(
        cardset.quantity
        for cardset in nonland_scoped_cardsets(deck, exclude_oracle_id=exclude_oracle_id)
    )


def mana_cost_pips(card: ScryfallCardSnapshot) -> dict[str, int]:
    counts = dict.fromkeys(COLOR_LABELS, 0)
    mana_costs = (
        [card.mana_cost] if card.mana_cost else [face.mana_cost for face in card.card_faces]
    )
    for mana_cost in mana_costs:
        if not mana_cost:
            continue
        for symbol in _mana_symbols(mana_cost):
            for color in COLOR_LABELS:
                counts[color] += symbol.count(color)
    return {color: quantity for color, quantity in counts.items() if quantity > 0}


def type_labels(card: ScryfallCardSnapshot) -> list[str]:
    matches = {
        label for type_line in type_lines(card) for label in CARD_TYPE_LABELS if label in type_line
    }
    return sorted(matches) if matches else ["Other"]


def type_lines(card: ScryfallCardSnapshot) -> list[str]:
    if card.card_faces:
        return [face.type_line for face in card.card_faces if face.type_line]
    return [card.type_line]


def format_mana_value(value: float) -> str:
    return str(int(value)) if value.is_integer() else str(value)


def mana_curve_sort_key(cost: str) -> tuple[float, str]:
    try:
        return float(cost), cost
    except ValueError:
        return float("inf"), cost


def percentage_buckets(
    counts: Mapping[str, int | float],
    *,
    labels: dict[str, str] | None = None,
    order: Sequence[str] | None = None,
    denominator: int | None = None,
) -> list[dict[str, str | int | float]]:
    if not counts:
        return []
    total = denominator if denominator is not None else sum(counts.values())
    if total <= 0:
        return []
    keys = list(order) if order is not None else sorted(counts)
    buckets: list[dict[str, str | int | float]] = []
    for key in keys:
        quantity = counts.get(key)
        if quantity is None or quantity <= 0:
            continue
        buckets.append(
            {
                "key": key,
                "label": labels.get(key, key) if labels is not None else key,
                "quantity": quantity,
                "percentage": round((quantity / total) * 100, 1),
            }
        )
    if order is None:
        return buckets
    remaining = sorted(set(counts) - set(order))
    for key in remaining:
        quantity = counts[key]
        if quantity <= 0:
            continue
        buckets.append(
            {
                "key": key,
                "label": labels.get(key, key) if labels is not None else key,
                "quantity": quantity,
                "percentage": round((quantity / total) * 100, 1),
            }
        )
    return buckets


def _mana_symbols(mana_cost: str) -> list[str]:
    symbols: list[str] = []
    start = 0
    while True:
        left = mana_cost.find("{", start)
        if left < 0:
            return symbols
        right = mana_cost.find("}", left + 1)
        if right < 0:
            return symbols
        symbols.append(mana_cost[left + 1 : right].upper())
        start = right + 1
