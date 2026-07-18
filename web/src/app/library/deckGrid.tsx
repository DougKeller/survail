import { useNavigate } from "react-router-dom";
import type { Dispatch, MouseEvent, SetStateAction } from "react";

import { Grid } from "../../designsystem/layout/grid";
import { FlexSpacer, Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Art } from "../../designsystem/primitives/artPlaceholder";
import {
  Card,
  CardContent,
  CardMeta,
  CardTitle,
} from "../../designsystem/primitives/card";
import { Menu, MenuItem } from "../../designsystem/primitives/menu";
import { Meter } from "../../designsystem/primitives/progress";
import { Tag } from "../../designsystem/primitives/tag";
import { GhostTile } from "../../designsystem/patterns/emptyTile";
import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import { titleize } from "../deckPrimitives";

import type { Deck } from "../../modules/decks/contracts";

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeUpdatedAt(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(elapsedMs / 60_000);
  if (minutes < 60) return relativeFormat.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relativeFormat.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return relativeFormat.format(-days, "day");
  if (days < 30) return relativeFormat.format(-Math.round(days / 7), "week");
  if (days < 365) return relativeFormat.format(-Math.round(days / 30), "month");
  return relativeFormat.format(-Math.round(days / 365), "year");
}

export interface DeckProgress {
  count: number;
  label: string;
  ready: boolean;
  target: number;
}

/** Completion toward the format's deck target: commander decks count the
    command zone toward 100; other formats count 60 mainboard cards. */
function deckProgress(deck: Pick<Deck, "cardsets" | "format">): DeckProgress {
  const isCommander = deck.format === "commander";
  const target = isCommander ? 100 : 60;
  const count = deck.cardsets
    .filter(
      (card) =>
        card.zone === "mainboard" || (isCommander && card.zone === "commander"),
    )
    .reduce((total, card) => total + card.quantity, 0);
  const ready = count >= target;
  const remaining = target - count;
  const label = ready
    ? `Ready to play · ${String(count)}/${String(target)}`
    : `Drafting · ${String(count)}/${String(target)} · ${String(remaining)} to go`;
  return {
    count,
    label,
    ready,
    target,
  };
}

export function DeckGrid({
  decks,
  openDeckMenu,
  setOpenDeckMenu,
  deleteDeck,
  onAddDeck,
}: {
  decks: Deck[];
  openDeckMenu: string | null;
  setOpenDeckMenu: Dispatch<SetStateAction<string | null>>;
  deleteDeck: (deck: Deck) => Promise<void>;
  onAddDeck: () => void;
}) {
  const navigate = useNavigate();

  function openDeck(deckId: string) {
    return (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      void navigate(`/decks/${deckId}`);
    };
  }

  return (
    <Grid>
      {decks.map((deck) => {
        const progress = deckProgress(deck);
        const totalCards = deck.cardsets.reduce(
          (total, card) => total + card.quantity,
          0,
        );
        return (
          <Card as="article" elevation="sm" key={deck.id} padded={false}>
            <Art size="md">
              {deck.cardsets.slice(0, 3).map((card) => (
                <ClickableCardImage card={card} key={card.id} />
              ))}
            </Art>
            <CardContent>
              <Inline gap={2}>
                <CardTitle
                  href={`/decks/${deck.id}`}
                  onClick={openDeck(deck.id)}
                >
                  {deck.title}
                </CardTitle>
                <FlexSpacer />
                <Menu
                  id={`deck-menu-${deck.id}`}
                  label={`Actions for ${deck.title}`}
                  onToggle={() => {
                    setOpenDeckMenu((current) =>
                      current === deck.id ? null : deck.id,
                    );
                  }}
                  open={openDeckMenu === deck.id}
                >
                  <MenuItem
                    autoFocus
                    danger
                    onSelect={() => void deleteDeck(deck)}
                  >
                    Delete deck
                  </MenuItem>
                </Menu>
              </Inline>
              <Inline gap={1} wrap>
                <Tag tone="accent">{titleize(deck.format)}</Tag>
                <Tag tone="neutral">{totalCards} cards</Tag>
              </Inline>
              <Stack gap={1}>
                <Meter
                  label={`${deck.title} completion`}
                  max={progress.target}
                  size="sm"
                  tone={progress.ready ? "accent2" : "accent"}
                  value={progress.count}
                />
                <CardMeta tone={progress.ready ? undefined : "accent"}>
                  {progress.label}
                </CardMeta>
              </Stack>
              <CardMeta title={new Date(deck.updated_at).toLocaleString()}>
                Updated {relativeUpdatedAt(deck.updated_at)}
              </CardMeta>
            </CardContent>
          </Card>
        );
      })}
      <GhostTile label="New deck" onClick={onAddDeck} />
    </Grid>
  );
}
