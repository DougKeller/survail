import { useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";

import { ApiError } from "../../core/http/client";
import { InlineCardText } from "../../modules/cards/ui/cardPresentation";
import type { ScryfallCard } from "../../modules/cards/contracts";
import type {
  CardFinish,
  CardSet,
  CardZone,
  GeneratedDeckDescriptionContent,
  PriceProvider,
} from "../../modules/decks/contracts";

import { PriceProviderContext } from "./constants";

export function titleize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function toolLabel(toolName: string): string {
  return titleize(toolName);
}

export function truncatedHint(detail: string, maxLength = 180): string {
  return detail.length <= maxLength
    ? detail
    : `${detail.slice(0, maxLength).trimEnd()}…`;
}

export function zoneLabel(zone: CardZone): string {
  if (zone === "commander") return "Command zone";
  return zone.charAt(0).toUpperCase() + zone.slice(1);
}

export function RichTextBlock({
  text,
  cards,
}: {
  text: string;
  cards: CardSet[];
}) {
  const lines = text.split("\n");
  return (
    <div className="generated-description">
      {lines.map((line, index) => {
        if (line.startsWith("# ")) {
          return (
            <h3 key={String(index)}>
              <InlineCardText cards={cards} text={line.slice(2)} />
            </h3>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <div className="gameplan-item" key={String(index)}>
              <MaterialIcon name="arrow_right" />
              <p>
                <InlineCardText cards={cards} text={line.slice(2)} />
              </p>
            </div>
          );
        }
        if (line.trim() === "") return null;
        return (
          <p key={String(index)}>
            <InlineCardText cards={cards} text={line} />
          </p>
        );
      })}
    </div>
  );
}

export function GeneratedDescription({
  description,
  cards,
}: {
  description: GeneratedDeckDescriptionContent | string;
  cards: CardSet[];
}) {
  if (typeof description === "string") {
    return <RichTextBlock cards={cards} text={description} />;
  }
  return (
    <div className="generated-description" aria-live="polite">
      <h3>Overview</h3>
      <p>
        <InlineCardText cards={cards} text={description.overview} />
      </p>
      <h3>Gameplan</h3>
      {(
        [
          ["Turns 1-3", description.early_game],
          ["Midgame", description.midgame],
          ["Lategame", description.lategame],
        ] as [string, string][]
      ).map(([label, text]) => (
        <div className="gameplan-item" key={label}>
          <MaterialIcon name="arrow_right" />
          <p>
            <strong>{label}</strong>
            {": "}
            <InlineCardText cards={cards} text={text} />
          </p>
        </div>
      ))}
    </div>
  );
}

export function messageFor(error: Error): string {
  if (error instanceof ApiError && error.status === 409) {
    return "This deck changed in another session. The latest version was loaded; retry your change.";
  }
  return error.message;
}

function displayPrice(
  card: ScryfallCard,
  finish: CardFinish,
  provider: PriceProvider,
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

export function Price({
  card,
  finish,
}: {
  card: ScryfallCard;
  finish: CardFinish;
}) {
  const provider = useContext(PriceProviderContext);
  const price = displayPrice(card, finish, provider);
  return price === null ? null : <small className="price">{price}</small>;
}

export function MaterialIcon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  );
}

export function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
  return null;
}
