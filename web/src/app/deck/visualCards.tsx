import { useContext } from "react";

import type { CardSet, DeckFormat } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";

import {
  type DeckView,
  type GroupBy,
  PriceProviderContext,
  type SortBy,
} from "./constants";
import { groupedCards } from "./grouping";
import { MaterialIcon } from "./text";

function commanderEligible(
  card: CardSet["scryfall"],
  format: DeckFormat,
): boolean {
  if (format !== "commander" && format !== "brawl") return false;
  const explicitlyEligible =
    card.oracle_text?.toLowerCase().includes("can be your commander") === true;
  const legendary = card.type_line.includes("Legendary");
  const creature = card.type_line.includes("Creature");
  const planeswalker = card.type_line.includes("Planeswalker");
  const background = card.type_line.includes("Background");
  return (
    explicitlyEligible ||
    background ||
    (legendary && (creature || (format === "brawl" && planeswalker)))
  );
}

function DeckCardImage({
  cardset,
  open,
  disabled,
}: {
  cardset: CardSet;
  open: () => void;
  disabled: boolean;
}) {
  return (
    <div className="card-art">
      <ClickableCardImage card={cardset} className="card-image" />
      <button
        aria-label={`Choose printing for ${cardset.card_name}`}
        className="art-button"
        disabled={disabled}
        onClick={open}
        title="Choose printing"
      >
        <MaterialIcon name="imagesmode" />
      </button>
    </div>
  );
}

function ImageCard(props: {
  card: CardSet;
  open: () => void;
  add: () => void;
  remove: () => void;
  markCommander: (() => void) | null;
  disabled: boolean;
  stacked: boolean;
  index: number;
  score: CardRoleEvaluation | null;
}) {
  const {
    card,
    open,
    add,
    remove,
    markCommander,
    disabled,
    stacked,
    index,
    score,
  } = props;
  return (
    <div
      className={stacked ? "stacked-card" : "grid-card"}
      style={
        stacked
          ? ({ "--stack-index": index } as React.CSSProperties)
          : undefined
      }
    >
      <DeckCardImage cardset={card} disabled={disabled} open={open} />
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
        <button
          aria-label={`Remove one ${card.card_name}`}
          disabled={disabled}
          onClick={remove}
        >
          <MaterialIcon name="remove" />
        </button>
        <button
          aria-label={`Add one ${card.card_name}`}
          disabled={disabled}
          onClick={add}
        >
          <MaterialIcon name="add" />
        </button>
        {markCommander !== null && (
          <button
            aria-label={`Mark ${card.card_name} as commander`}
            disabled={disabled}
            onClick={markCommander}
          >
            <MaterialIcon name="shield_person" />
          </button>
        )}
      </div>
    </div>
  );
}

export function VisualCardGroups(props: {
  cards: CardSet[];
  view: Exclude<DeckView, "text">;
  groupBy: GroupBy;
  sortBy: SortBy;
  format: DeckFormat;
  openPrinting: (card: CardSet) => void;
  addCard: (card: CardSet) => void;
  removeCard: (card: CardSet) => void;
  markCommander: (card: CardSet) => void;
  busy: boolean;
  scores: ReadonlyMap<string, CardRoleEvaluation>;
}) {
  const {
    cards,
    view,
    groupBy,
    sortBy,
    format,
    openPrinting,
    addCard,
    removeCard,
    markCommander,
    busy,
    scores,
  } = props;
  const provider = useContext(PriceProviderContext);
  return (
    <div className={`visual-groups ${view}`}>
      {groupedCards(cards, groupBy, sortBy, provider, scores).map((group) => (
        <section className="visual-group" key={group.label}>
          <h3>
            {group.label} <small>{group.quantity}</small>
          </h3>
          <div
            className={view === "stacks" ? "card-stacks" : "visual-card-grid"}
          >
            {group.cards.flatMap((card) =>
              Array.from(
                { length: view === "stacks" ? card.quantity : 1 },
                (_, index) => (
                  <ImageCard
                    add={() => {
                      addCard(card);
                    }}
                    card={card}
                    disabled={busy}
                    index={index}
                    key={`${card.id}-${String(index)}`}
                    markCommander={
                      card.zone !== "commander" &&
                      commanderEligible(card.scryfall, format)
                        ? () => {
                            markCommander(card);
                          }
                        : null
                    }
                    open={() => {
                      openPrinting(card);
                    }}
                    remove={() => {
                      removeCard(card);
                    }}
                    score={null}
                    stacked={view === "stacks"}
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
