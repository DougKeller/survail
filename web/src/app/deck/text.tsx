import { useContext, useEffect, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUp } from "lucide-react";
import { useLocation } from "react-router-dom";

import { listenForViewportChanges } from "../../core/continuousEventFrame";
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
import { BackToTopButton } from "../../designsystem/primitives/backToTop";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Text } from "../../designsystem/layout/typography";

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

function GameplanItem({ children }: { children: ReactNode }) {
  return (
    <Inline align="start" gap={2}>
      <ArrowRight aria-hidden="true" size={14} strokeWidth={2.75} />
      <Text as="span">{children}</Text>
    </Inline>
  );
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
    <Stack gap={2}>
      {lines.map((line, index) => {
        if (line.startsWith("# ")) {
          return (
            <Heading key={String(index)} level={3} size="md">
              <InlineCardText cards={cards} text={line.slice(2)} />
            </Heading>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <GameplanItem key={String(index)}>
              <InlineCardText cards={cards} text={line.slice(2)} />
            </GameplanItem>
          );
        }
        if (line.trim() === "") return null;
        return (
          <Text key={String(index)}>
            <InlineCardText cards={cards} text={line} />
          </Text>
        );
      })}
    </Stack>
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
    <Stack aria-live="polite" gap={2}>
      <Heading level={3} size="md">
        Overview
      </Heading>
      <Text>
        <InlineCardText cards={cards} text={description.overview} />
      </Text>
      <Heading level={3} size="md">
        Gameplan
      </Heading>
      {(
        [
          ["Turns 1-3", description.early_game],
          ["Midgame", description.midgame],
          ["Lategame", description.lategame],
        ] as [string, string][]
      ).map(([label, text]) => (
        <GameplanItem key={label}>
          <strong>{label}</strong>
          {": "}
          <InlineCardText cards={cards} text={text} />
        </GameplanItem>
      ))}
    </Stack>
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
  return price === null ? null : (
    <Text as="span" muted size="sm">
      {price}
    </Text>
  );
}

export function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
  return null;
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleThreshold = 360;
    const syncVisible = () => {
      setVisible(window.scrollY > toggleThreshold);
    };

    syncVisible();
    return listenForViewportChanges(syncVisible);
  }, []);

  return (
    <BackToTopButton
      icon={<ArrowUp size={14} strokeWidth={2.75} />}
      onClick={() => {
        window.scrollTo({ left: 0, top: 0, behavior: "smooth" });
      }}
      visible={visible}
    />
  );
}
