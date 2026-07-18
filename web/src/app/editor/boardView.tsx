import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Star } from "lucide-react";

import {
  ClickableCardImage,
  InlineCardText,
} from "../../modules/cards/ui/cardPresentation";
import type {
  CardSet,
  CardZone,
  Deck,
  PriceProvider,
} from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { IconButton } from "../../designsystem/primitives/button";
import { ManaCost, Pip } from "../../designsystem/primitives/pip";
import { Popover, PopoverAnchor } from "../../designsystem/primitives/popover";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { Board, BoardColumn } from "../../designsystem/layout/board";
import { AddRow } from "../../designsystem/patterns/addRow";
import { CardRow } from "../../designsystem/patterns/cardRow";
import { ColumnHeader } from "../../designsystem/patterns/columnHeader";
import type { GroupBy, SortBy } from "../deck/constants";
import { groupedCards } from "../deck/grouping";
import {
  CardNoteButton,
  MoveZoneSelect,
  QuantityStepper,
} from "../deck/cardRowActions";
import {
  CoreCardToggle,
  useDismissibleSurface,
  zoneLabel,
  zonesFor,
} from "../deckPrimitives";
import { useDeckEditorContext } from "./deckEditorContext";

function CardQuickActions({ card }: { card: CardSet }) {
  const {
    actions: { changeQuantity, moveCardToZone, toggleCoreCard },
    data: { busy },
    deck,
    modals: { setActiveCardNote },
  } = useDeckEditorContext();
  const [open, setOpen] = useState(false);
  const containerRef = useDismissibleSurface<HTMLDivElement>(
    open,
    () => {
      setOpen(false);
    },
    { manageFocus: false },
  );

  useEffect(() => {
    if (card.quantity <= 0) setOpen(false);
  }, [card.quantity]);

  return (
    <PopoverAnchor ref={containerRef}>
      <IconButton
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={busy}
        label={`Open quick actions for ${card.card_name}`}
        onClick={() => {
          setOpen((current) => !current);
        }}
        size="sm"
        title="Open quick actions"
        variant="ghost"
      >
        {open ? (
          <ChevronUp size={14} strokeWidth={2.75} />
        ) : (
          <ChevronDown size={14} strokeWidth={2.75} />
        )}
      </IconButton>
      {open && (
        <Popover align="end" label={`${card.card_name} quick actions`}>
          <Stack gap={2}>
            <Inline gap={1}>
              <QuantityStepper
                busy={busy}
                card={card}
                onAdd={() => {
                  changeQuantity(card, 1);
                }}
                onRemove={() => {
                  if (card.quantity <= 1) setOpen(false);
                  changeQuantity(card, -1);
                }}
                showCount
                withTitles
              />
              <CoreCardToggle
                active={card.core}
                disabled={busy}
                label={card.card_name}
                onClick={() => {
                  toggleCoreCard(card);
                }}
              />
              <CardNoteButton
                busy={busy}
                card={card}
                onClick={() => {
                  setOpen(false);
                  setActiveCardNote(card);
                }}
                withTitle
              />
            </Inline>
            <MoveZoneSelect
              busy={busy}
              card={card}
              format={deck.format}
              onMove={(zone) => {
                setOpen(false);
                moveCardToZone(card, zone);
              }}
              placeholder="Select zone"
              wrapWithLabel
            />
          </Stack>
        </Popover>
      )}
    </PopoverAnchor>
  );
}

function BoardCardRow({
  card,
  commander,
  onPreview,
}: {
  card: CardSet;
  commander: boolean;
  onPreview: (card: CardSet) => void;
}) {
  const note = card.note.trim();
  return (
    <Stack gap={1}>
      <CardRow
        emphasis={commander}
        leading={commander ? <ClickableCardImage card={card} /> : undefined}
        name={<InlineCardText cards={[card]} text={`[[${card.card_name}]]`} />}
        onFocus={() => {
          onPreview(card);
        }}
        onPointerEnter={() => {
          onPreview(card);
        }}
        qty={card.quantity}
        tone={commander ? "accent-2" : "default"}
      >
        {card.core && (
          <Pip
            aria-label={`${card.card_name} is starred as a core card`}
            role="img"
            title="Starred core card"
            tone="accent"
          >
            <Star fill="currentColor" size={9} strokeWidth={2.75} />
          </Pip>
        )}
        <ManaCost cost={card.scryfall.mana_cost} />
        <CardQuickActions card={card} />
      </CardRow>
      {note !== "" && (
        <Text muted size="2xs">
          {note}
        </Text>
      )}
    </Stack>
  );
}

interface BoardColumnData {
  addZone: CardZone;
  cards: CardSet[];
  commander: boolean;
  count: number;
  key: string;
  title: string;
}

function boardColumns(
  deck: Deck,
  groupBy: GroupBy,
  sortBy: SortBy,
  priceProvider: PriceProvider,
  scores: ReadonlyMap<string, CardRoleEvaluation>,
): BoardColumnData[] {
  const columns: BoardColumnData[] = [];
  for (const zone of zonesFor(deck.format)) {
    const zoneCards = deck.cardsets.filter((card) => card.zone === zone);
    const count = zoneCards.reduce((total, card) => total + card.quantity, 0);
    if (zone === "mainboard") {
      const groups = groupedCards(
        zoneCards,
        groupBy,
        sortBy,
        priceProvider,
        scores,
      );
      if (groups.length === 0) {
        columns.push({
          addZone: zone,
          cards: [],
          commander: false,
          count: 0,
          key: zone,
          title: zoneLabel(zone),
        });
      }
      for (const group of groups) {
        columns.push({
          addZone: zone,
          cards: group.cards,
          commander: false,
          count: group.quantity,
          key: `${zone}-${group.label}`,
          title: groups.length === 1 ? zoneLabel(zone) : group.label,
        });
      }
    } else if (zone === "commander" || zoneCards.length > 0) {
      columns.push({
        addZone: zone,
        cards: [...zoneCards].sort((a, b) =>
          a.card_name.localeCompare(b.card_name),
        ),
        commander: zone === "commander",
        count,
        key: zone,
        title: zoneLabel(zone),
      });
    }
  }
  return columns;
}

export function DeckBoard({
  onAddToZone,
  onPreview,
}: {
  onAddToZone: (zone: CardZone) => void;
  onPreview: (card: CardSet) => void;
}) {
  const {
    deck,
    display: { displayPreferences, priceProvider },
    scoring: { scores },
  } = useDeckEditorContext();
  const { groupBy, sortBy } = displayPreferences;
  const columns = boardColumns(deck, groupBy, sortBy, priceProvider, scores);
  return (
    <Board>
      {columns.map((column) => (
        <BoardColumn
          key={column.key}
          width={column.commander ? "narrow" : "default"}
        >
          <ColumnHeader count={column.count} title={column.title} />
          {column.cards.map((card) => (
            <BoardCardRow
              card={card}
              commander={column.commander}
              key={`${column.key}-${card.id}`}
              onPreview={onPreview}
            />
          ))}
          <AddRow
            onClick={() => {
              onAddToZone(column.addZone);
            }}
          >
            add to {column.title}
          </AddRow>
        </BoardColumn>
      ))}
    </Board>
  );
}
