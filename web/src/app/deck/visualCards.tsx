import { useContext, type CSSProperties } from "react";
import { ShieldUser } from "lucide-react";

import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type {
  CardSet,
  CardZone,
  DeckFormat,
} from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { IconButton } from "../../designsystem/primitives/button";
import {
  CardStack,
  ImageGrid,
  StackColumns,
  StackSection,
} from "../../designsystem/layout/cardGallery";
import { Heading, Text } from "../../designsystem/layout/typography";
import {
  GroupTile,
  ImageTile,
  ImageTileActions,
  ImageTileBadge,
} from "../../designsystem/patterns/imageTile";
import {
  CardNoteButton,
  MoveZoneSelect,
  QuantityStepper,
} from "./cardRowActions";
import { canMoveToCommanderZone } from "./cardZones";
import { CoreCardToggle } from "./coreCardToggle";
import {
  type DeckView,
  type GroupBy,
  PriceProviderContext,
  type SortBy,
} from "./constants";
import { groupPlaceholderLabel, groupSwatch } from "./groupColors";
import { groupedCards, type CardGroup } from "./grouping";

function ImageCard(props: {
  card: CardSet;
  add: () => void;
  editNote: () => void;
  remove: () => void;
  move: (zone: CardZone) => void;
  markCommander: (() => void) | null;
  toggleCore: () => void;
  disabled: boolean;
  stacked: boolean;
  score: CardRoleEvaluation | null;
  format: DeckFormat;
}) {
  const {
    card,
    add,
    editNote,
    format,
    move,
    remove,
    markCommander,
    toggleCore,
    disabled,
    stacked,
    score,
  } = props;
  return (
    <ImageTile>
      <ClickableCardImage card={card} />
      {!stacked && card.quantity > 1 && (
        <ImageTileBadge aria-label={`${String(card.quantity)} copies`}>
          ×{card.quantity}
        </ImageTileBadge>
      )}
      {score !== null && (
        <ImageTileBadge
          aria-label={`${String(score.overall_score)} role score`}
          corner="bottom-right"
          title={score.roles
            .map((role) => `${role.role} ${String(role.score)}`)
            .join(", ")}
          tone="accent"
        >
          {score.overall_score}
        </ImageTileBadge>
      )}
      <ImageTileActions>
        <CoreCardToggle
          active={card.core}
          disabled={disabled}
          label={card.card_name}
          onClick={toggleCore}
        />
        <CardNoteButton busy={disabled} card={card} onClick={editNote} />
        <QuantityStepper
          busy={disabled}
          card={card}
          onAdd={add}
          onRemove={remove}
        />
        <MoveZoneSelect
          busy={disabled}
          card={card}
          format={format}
          onMove={move}
          placeholder="Move"
        />
        {markCommander !== null && (
          <IconButton
            disabled={disabled}
            label={`Mark ${card.card_name} as commander`}
            onClick={markCommander}
            size="sm"
            variant="ghost"
          >
            <ShieldUser size={14} strokeWidth={2.75} />
          </IconButton>
        )}
      </ImageTileActions>
    </ImageTile>
  );
}

function GroupPlaceholder({
  group,
  groupBy,
}: {
  group: CardGroup;
  groupBy: GroupBy;
}) {
  const label = groupPlaceholderLabel(groupBy, group.label);
  const accent = groupSwatch(groupBy, group.label);
  return (
    <GroupTile
      aria-label={`${label} group with ${String(group.quantity)} cards`}
      count={`${String(group.quantity)} cards`}
      eyebrow={titleFor(groupBy)}
      style={{ "--ds-group-accent": accent } as CSSProperties}
      title={label}
    />
  );
}

function titleFor(groupBy: GroupBy): string {
  if (groupBy === "mana-value") return "Mana value";
  if (groupBy === "type") return "Card type";
  return groupBy.charAt(0).toUpperCase() + groupBy.slice(1);
}

export function VisualCardGroups(props: {
  cards: CardSet[];
  view: Exclude<DeckView, "text">;
  groupBy: GroupBy;
  sortBy: SortBy;
  format: DeckFormat;
  addCard: (card: CardSet) => void;
  moveCardToZone: (card: CardSet, zone: CardZone) => void;
  removeCard: (card: CardSet) => void;
  editCardNote: (card: CardSet) => void;
  markCommander: (card: CardSet) => void;
  toggleCoreCard: (card: CardSet) => void;
  busy: boolean;
  scores: ReadonlyMap<string, CardRoleEvaluation>;
}) {
  const {
    cards,
    view,
    groupBy,
    sortBy,
    format,
    addCard,
    editCardNote,
    moveCardToZone,
    removeCard,
    markCommander,
    toggleCoreCard,
    busy,
    scores,
  } = props;
  const provider = useContext(PriceProviderContext);
  const groups = groupedCards(cards, groupBy, sortBy, provider, scores);

  if (view === "grid") {
    return (
      <ImageGrid>
        {groups.flatMap((group) => [
          <GroupPlaceholder
            group={group}
            groupBy={groupBy}
            key={`${group.label}-placeholder`}
          />,
          ...group.cards.map((card) => (
            <ImageCard
              add={() => {
                addCard(card);
              }}
              card={card}
              disabled={busy}
              editNote={() => {
                editCardNote(card);
              }}
              format={format}
              key={card.id}
              markCommander={
                card.zone !== "commander" &&
                canMoveToCommanderZone(card.scryfall, format)
                  ? () => {
                      markCommander(card);
                    }
                  : null
              }
              move={(zone) => {
                moveCardToZone(card, zone);
              }}
              remove={() => {
                removeCard(card);
              }}
              score={null}
              stacked={false}
              toggleCore={() => {
                toggleCoreCard(card);
              }}
            />
          )),
        ])}
      </ImageGrid>
    );
  }

  return (
    <StackColumns>
      {groups.map((group) => (
        <StackSection key={group.label}>
          <Heading level={3} size="md">
            {group.label}{" "}
            <Text as="span" muted size="sm">
              {group.quantity}
            </Text>
          </Heading>
          <CardStack>
            {group.cards.flatMap((card) =>
              Array.from({ length: card.quantity }, (_, index) => (
                <ImageCard
                  add={() => {
                    addCard(card);
                  }}
                  card={card}
                  disabled={busy}
                  editNote={() => {
                    editCardNote(card);
                  }}
                  format={format}
                  key={`${card.id}-${String(index)}`}
                  markCommander={
                    card.zone !== "commander" &&
                    canMoveToCommanderZone(card.scryfall, format)
                      ? () => {
                          markCommander(card);
                        }
                      : null
                  }
                  move={(zone) => {
                    moveCardToZone(card, zone);
                  }}
                  remove={() => {
                    removeCard(card);
                  }}
                  score={null}
                  stacked
                  toggleCore={() => {
                    toggleCoreCard(card);
                  }}
                />
              )),
            )}
          </CardStack>
        </StackSection>
      ))}
    </StackColumns>
  );
}
