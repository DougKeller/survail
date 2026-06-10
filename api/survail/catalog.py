import re
import shlex
from dataclasses import dataclass

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from survail.models import CatalogCard
from survail.schemas import CardPrices, ScryfallCardSnapshot

_FIELD_TOKEN = re.compile(
    r"^(?P<field>[a-z_]+)(?P<operator>:|=|<=|>=|<|>)(?P<value>.+)$",
    re.IGNORECASE,
)
_SUPPORTED_FIELDS = {
    "name",
    "n",
    "oracle",
    "o",
    "type",
    "t",
    "set",
    "s",
    "rarity",
    "r",
    "format",
    "f",
    "legal",
    "color",
    "c",
    "identity",
    "id",
    "lang",
    "mv",
    "cmc",
}
_NON_PLAYABLE_LAYOUTS = frozenset(
    {
        "art_series",
        "double_faced_token",
        "emblem",
        "planar",
        "scheme",
        "token",
        "vanguard",
    }
)


class CatalogQueryError(ValueError):
    pass


@dataclass(frozen=True)
class SearchTerm:
    field: str
    operator: str
    value: str
    negated: bool = False


def parse_query(query: str) -> list[SearchTerm]:
    try:
        tokens = shlex.split(query)
    except ValueError as exc:
        raise CatalogQueryError("Invalid quoted search value") from exc
    terms: list[SearchTerm] = []
    for raw_token in tokens:
        negated = raw_token.startswith("-")
        token = raw_token[1:] if negated else raw_token
        match = _FIELD_TOKEN.match(token)
        if match is None:
            terms.append(SearchTerm("name", ":", token, negated))
            continue
        field = match.group("field").lower()
        if field not in _SUPPORTED_FIELDS:
            raise CatalogQueryError(f"Unsupported search operator: {field}")
        terms.append(SearchTerm(field, match.group("operator"), match.group("value"), negated))
    if not terms:
        raise CatalogQueryError("Search query must not be blank")
    return terms


class CatalogRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_printing(self, printing_id: str) -> ScryfallCardSnapshot | None:
        card = self._db.get(CatalogCard, printing_id)
        return _snapshot(card) if card is not None else None

    def exact_name(self, name: str) -> ScryfallCardSnapshot | None:
        card = self._db.scalar(
            select(CatalogCard)
            .where(
                CatalogCard.name.ilike(name),
                CatalogCard.lang == "en",
                CatalogCard.layout.not_in(_NON_PLAYABLE_LAYOUTS),
            )
            .order_by(CatalogCard.released_at.desc().nullslast())
            .limit(1)
        )
        return _snapshot(card) if card is not None else None

    def printing_records_by_name(self, name: str) -> list[CatalogCard]:
        canonical_name = name.replace(" / ", " // ")
        return list(
            self._db.scalars(
                select(CatalogCard)
                .where(
                    CatalogCard.name.ilike(canonical_name),
                    CatalogCard.lang == "en",
                    CatalogCard.layout.not_in(_NON_PLAYABLE_LAYOUTS),
                )
                .order_by(CatalogCard.released_at.desc().nullslast(), CatalogCard.id)
            )
        )

    def printing_records_by_oracle(self, oracle_id: str) -> list[CatalogCard]:
        return list(
            self._db.scalars(
                select(CatalogCard)
                .where(
                    CatalogCard.oracle_id == oracle_id,
                    CatalogCard.lang == "en",
                    CatalogCard.layout.not_in(_NON_PLAYABLE_LAYOUTS),
                )
                .order_by(CatalogCard.released_at.desc().nullslast(), CatalogCard.id)
            )
        )

    def search(
        self, query: str, page: int = 1, page_size: int = 60
    ) -> tuple[list[ScryfallCardSnapshot], int, bool]:
        terms = parse_query(query)
        statement = select(CatalogCard)
        statement = statement.where(CatalogCard.layout.not_in(_NON_PLAYABLE_LAYOUTS))
        if not any(term.field == "lang" for term in terms):
            statement = statement.where(CatalogCard.lang == "en")
        for term in terms:
            statement = statement.where(_term_expression(term))
        count = self._db.scalar(
            select(func.count()).select_from(statement.order_by(None).subquery())
        )
        total = int(count or 0)
        cards = self._db.scalars(
            statement.order_by(
                func.similarity(CatalogCard.name, query).desc(),
                CatalogCard.name,
                CatalogCard.released_at.desc().nullslast(),
            )
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        snapshots = [_snapshot(card) for card in cards]
        return snapshots, total, page * page_size < total


def _term_expression(term: SearchTerm) -> ColumnElement[bool]:
    field = term.field
    value = term.value
    expression: ColumnElement[bool]
    if field in {"name", "n"}:
        expression = CatalogCard.name.ilike(f"%{value}%")
    elif field in {"oracle", "o"}:
        expression = CatalogCard.oracle_text.ilike(f"%{value}%")
    elif field in {"type", "t"}:
        expression = CatalogCard.type_line.ilike(f"%{value}%")
    elif field in {"set", "s"}:
        expression = CatalogCard.set_code == value.lower()
    elif field in {"rarity", "r"}:
        expression = CatalogCard.rarity == value.lower()
    elif field in {"format", "f", "legal"}:
        expression = CatalogCard.legalities[value.lower()].as_string().in_(["legal", "restricted"])
    elif field in {"color", "c"}:
        expression = _color_expression(CatalogCard.colors, value)
    elif field in {"identity", "id"}:
        expression = _color_expression(CatalogCard.color_identity, value)
    elif field == "lang":
        expression = CatalogCard.lang == value.lower()
    elif field in {"mv", "cmc"}:
        expression = _numeric_expression(term.operator, value)
    else:
        raise CatalogQueryError(f"Unsupported search operator: {field}")
    return ~expression if term.negated else expression


def _color_expression(column: InstrumentedAttribute[list[str]], value: str) -> ColumnElement[bool]:
    normalized = value.upper()
    if normalized in {"C", "COLORLESS"}:
        return column == []
    colors = list(dict.fromkeys(normalized.replace(",", "")))
    if not colors or any(color not in "WUBRG" for color in colors):
        raise CatalogQueryError(f"Invalid color value: {value}")
    return and_(*(column.contains([color]) for color in colors))


def _numeric_expression(operator: str, value: str) -> ColumnElement[bool]:
    try:
        number = float(value)
    except ValueError as exc:
        raise CatalogQueryError(f"Invalid mana value: {value}") from exc
    comparisons = {
        ":": CatalogCard.cmc == number,
        "=": CatalogCard.cmc == number,
        "<": CatalogCard.cmc < number,
        "<=": CatalogCard.cmc <= number,
        ">": CatalogCard.cmc > number,
        ">=": CatalogCard.cmc >= number,
    }
    return comparisons[operator]


def _snapshot(card: CatalogCard) -> ScryfallCardSnapshot:
    snapshot = ScryfallCardSnapshot.model_validate(card.snapshot, strict=False)
    return snapshot.model_copy(
        update={
            "prices": CardPrices(
                usd=card.usd,
                usd_foil=card.usd_foil,
                usd_etched=card.usd_etched,
                eur=card.eur,
                eur_foil=card.eur_foil,
                tix=card.tix,
            ),
            "border_color": card.border_color,
            "frame": card.frame,
            "universes_beyond": card.universes_beyond,
        }
    )
