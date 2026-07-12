/* eslint-disable max-lines */
import { useContext, type CSSProperties } from "react";

import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type {
  CardSet,
  CardZone,
  DeckFormat,
} from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import {
  canMoveToCommanderZone,
  moveZoneOptionsFor,
} from "./cardZones";
import { CoreCardToggle } from "./coreCardToggle";
import {
  type DeckView,
  type GroupBy,
  PriceProviderContext,
  type SortBy,
} from "./constants";
import { groupPlaceholderLabel, groupSwatch } from "./groupColors";
import { groupedCards, type CardGroup } from "./grouping";
import { MaterialIcon, zoneLabel } from "./text";

function DeckCardImage({
  cardset,
}: {
  cardset: CardSet;
}) {
  return (
    <div className="card-art">
      <ClickableCardImage card={cardset} className="card-image" />
    </div>
  );
}

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
  index: number;
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
    index,
    score,
  } = props;
  const moveOptions = moveZoneOptionsFor(card, format);
  return (
    <div
      className={stacked ? "stacked-card" : "grid-card"}
      style={
        stacked
          ? ({ "--stack-index": index } as React.CSSProperties)
          : undefined
      }
    >
      <DeckCardImage cardset={card} />
      {!stacked && card.quantity > 1 && (
        <span
          aria-label={`${String(card.quantity)} copies`}
          className="card-quantity"
        >
          ×{card.quantity}
        </span>
      )}
      {score !== null && (
        <span
          aria-label={`${String(score.overall_score)} role score`}
          className="card-score"
          title={score.roles
            .map((role) => `${role.role} ${String(role.score)}`)
            .join(", ")}
        >
          {score.overall_score}
        </span>
      )}
      <div className="card-quick-actions">
        <CoreCardToggle
          active={card.core}
          disabled={disabled}
          label={card.card_name}
          onClick={toggleCore}
        />
        <button
          aria-label={`${card.note.trim() === "" ? "Add" : "Edit"} note for ${card.card_name}`}
          disabled={disabled}
          onClick={editNote}
          type="button"
        >
          <MaterialIcon name="edit_note" />
        </button>
        <button
          aria-label={`Remove one ${card.card_name}`}
          disabled={disabled}
          onClick={remove}
          type="button"
        >
          <MaterialIcon name="remove" />
        </button>
        <button
          aria-label={`Add one ${card.card_name}`}
          disabled={disabled}
          onClick={add}
          type="button"
        >
          <MaterialIcon name="add" />
        </button>
        {moveOptions.length > 0 && (
          <select
            aria-label={`Move ${card.card_name} to another zone`}
            defaultValue=""
            disabled={disabled}
            onChange={(event) => {
              const zone = event.target.value;
              event.target.value = "";
              if (zone !== "") move(zone as CardZone);
            }}
          >
            <option value="">Move</option>
            {moveOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zoneLabel(zone)}
              </option>
            ))}
          </select>
        )}
        {markCommander !== null && (
          <button
            aria-label={`Mark ${card.card_name} as commander`}
            disabled={disabled}
            onClick={markCommander}
            type="button"
          >
            <MaterialIcon name="shield_person" />
          </button>
        )}
      </div>
    </div>
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
    <article
      aria-label={`${label} group with ${String(group.quantity)} cards`}
      className="group-placeholder-card"
      style={{ "--group-accent": accent } as CSSProperties}
    >
      <span className="group-placeholder-eyebrow">{titleFor(groupBy)}</span>
      <strong>{label}</strong>
      <span>{group.quantity} cards</span>
    </article>
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
      <div className="visual-card-flow-grid">
        {groups.flatMap((group) => [
          <GroupPlaceholder group={group} groupBy={groupBy} key={`${group.label}-placeholder`} />,
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
              index={0}
              key={card.id}
              markCommander={
                card.zone !== "commander" && canMoveToCommanderZone(card.scryfall, format)
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
      </div>
    );
  }

  return (
    <div className={`visual-groups ${view}`}>
      {groups.map((group) => (
        <section className="visual-group" key={group.label}>
          <h3>
            <span className="group-title-text">{group.label}</span>{" "}
            <small>{group.quantity}</small>
          </h3>
          <div className="card-stacks">
            {group.cards.flatMap((card) =>
              Array.from(
                { length: card.quantity },
                (_, index) => (
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
                    index={index}
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
                ),
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
