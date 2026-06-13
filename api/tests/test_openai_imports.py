from survail.integrations.openai.imports import _sanitized_import_text


def test_marketplace_import_sends_only_item_blocks_to_ai() -> None:
    text = """SHIP TO
Douglas Keller
5973 University Heights Cir NW
North Canton, OH 44720
ITEMS DETAILS PRICE QUANTITY
Viscera Seer
Commander Legends Rarity: C
Condition: Lightly Played $0.40 1
Order Date
June 10, 2026
"""

    sanitized = _sanitized_import_text(text)

    assert "Viscera Seer" in sanitized
    assert "Douglas Keller" not in sanitized
    assert "5973 University" not in sanitized


def test_single_line_marketplace_import_separates_orders() -> None:
    text = (
        "SHIP TO Douglas Keller ITEMS DETAILS PRICE QUANTITY Viscera Seer $0.40 1 "
        "Order Date June 10 ITEMS DETAILS PRICE QUANTITY Bloodghast $2.24 1"
    )

    sanitized = _sanitized_import_text(text)

    assert "Viscera Seer" in sanitized
    assert "Bloodghast" in sanitized
    assert "Douglas Keller" not in sanitized
