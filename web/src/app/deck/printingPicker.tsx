import { useContext, useEffect, useState } from "react";

import { printings as fetchPrintings } from "../../modules/cards/api/search";
import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type { ScryfallCard } from "../../modules/cards/contracts";
import type { CardFinish, CardSet } from "../../modules/decks/contracts";

import { PriceProviderContext } from "./constants";
import { preferredFinish } from "./grouping";
import { useModalBehavior } from "./hooks";
import { MaterialIcon, messageFor } from "./text";

function displayPrice(
  card: ScryfallCard,
  finish: CardFinish,
  provider: "tcgplayer" | "cardmarket" | "cardhoarder",
): string | null {
  const prices = card.prices;
  if (prices === undefined) return null;
  if (provider === "cardmarket") {
    const value = finish === "foil" ? prices.eur_foil : prices.eur;
    return value === null ? null : `€${value}`;
  }
  if (provider === "cardhoarder")
    return prices.tix === null ? null : `${prices.tix} TIX`;
  const value =
    finish === "foil"
      ? prices.usd_foil
      : finish === "etched"
        ? prices.usd_etched
        : prices.usd;
  return value === null ? null : `$${value}`;
}

export function PrintingPicker({
  cardset,
  close,
  select,
}: {
  cardset: CardSet;
  close: () => void;
  select: (printing: ScryfallCard, finish: CardFinish) => void;
}) {
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const provider = useContext(PriceProviderContext);
  const dialogRef = useModalBehavior<HTMLElement>(true, close);

  useEffect(() => {
    async function loadPrintings(): Promise<void> {
      try {
        setPrintings(await fetchPrintings(cardset.oracle_id));
      } catch (reason) {
        setError(
          reason instanceof Error
            ? messageFor(reason)
            : "Could not load printings",
        );
      }
    }
    void loadPrintings();
  }, [cardset.oracle_id]);

  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        aria-busy={printings.length === 0 && error === null}
        aria-describedby="printing-picker-description"
        aria-labelledby="printing-picker-title"
        aria-modal="true"
        className="printing-picker"
        onClick={(event) => {
          event.stopPropagation();
        }}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="page-heading">
          <div>
            <h2 id="printing-picker-title">{cardset.card_name} printings</h2>
            <p className="muted" id="printing-picker-description">
              Choose the edition and finish used in this deck.
            </p>
          </div>
          <button
            aria-label="Close printing picker"
            className="icon-action"
            onClick={close}
          >
            <MaterialIcon name="close" />
          </button>
        </div>
        {error !== null && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {printings.length === 0 && error === null && (
          <p role="status">Loading printings…</p>
        )}
        <div className="printing-grid">
          {printings.map((printing) => {
            const finish = preferredFinish(printing, cardset.finish);
            const price = displayPrice(printing, finish, provider);
            const selected =
              printing.id === cardset.printing_id && finish === cardset.finish;
            return (
              <article
                className={`printing-option${selected ? " selected" : ""}`}
                key={printing.id}
              >
                <ClickableCardImage
                  card={printing}
                  className="printing-image"
                />
                <strong>{printing.set_name}</strong>
                <small>
                  {printing.set.toUpperCase()} · {finish}
                </small>
                <small>
                  {printing.rarity} ·{" "}
                  {printing.released_at ?? "Release date unavailable"}
                </small>
                <small>
                  {printing.frame === null || printing.frame === undefined
                    ? "Frame unavailable"
                    : `${printing.frame} frame`}
                  {printing.universes_beyond === true
                    ? " · Universes Beyond"
                    : ""}
                </small>
                <small>{price ?? "Price unavailable"}</small>
                <button
                  disabled={selected}
                  onClick={() => {
                    select(printing, finish);
                  }}
                >
                  {selected ? "Current printing" : "Use this printing"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
