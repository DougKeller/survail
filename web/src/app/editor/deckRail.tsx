import { CircleAlert, CircleCheck } from "lucide-react";

import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type { CardSet, Deck } from "../../modules/decks/contracts";
import { Art } from "../../designsystem/primitives/artPlaceholder";
import { Chip } from "../../designsystem/primitives/chip";
import { FlexSpacer, Inline } from "../../designsystem/layout/inline";
import { Rail } from "../../designsystem/layout/rail";
import { Stack } from "../../designsystem/layout/stack";
import { Kicker } from "../../designsystem/layout/typography";
import { CurveBars } from "../../designsystem/patterns/curve";
import { ColorIdentityRow } from "../../designsystem/patterns/identity";
import { MeterPanel } from "../../designsystem/patterns/statPanel";
import { zoneLabel, zonesFor } from "../deckPrimitives";
import { CardTagPicker } from "./cardTagPicker";
import { useDeckEditorContext } from "./deckEditorContext";

const CURVE_LABELS = ["0", "1", "2", "3", "4", "5+"];
const IDENTITY_ORDER = ["W", "U", "B", "R", "G", "C"];
export const DECK_SUMMARY_ID = "deck-summary";

function deckTarget(format: Deck["format"]): number {
  return format === "commander" || format === "brawl" ? 100 : 60;
}

function curveValues(cards: CardSet[]): number[] {
  const buckets = [0, 0, 0, 0, 0, 0];
  for (const card of cards) {
    if (card.zone === "considering") continue;
    if (card.scryfall.type_line.includes("Land")) continue;
    const cmc = card.scryfall.cmc ?? 0;
    const bucket = Math.min(Math.max(Math.round(cmc), 0), 5);
    buckets[bucket] = (buckets[bucket] ?? 0) + card.quantity;
  }
  return buckets;
}

function identityColors(cards: CardSet[]): string[] {
  const union = new Set<string>();
  for (const card of cards) {
    for (const symbol of card.scryfall.color_identity ?? []) {
      union.add(symbol.toUpperCase());
    }
  }
  return IDENTITY_ORDER.filter((symbol) => union.has(symbol));
}

export function DeckRail({
  contained = false,
  previewCard,
}: {
  contained?: boolean;
  previewCard: CardSet | null;
}) {
  const {
    data: { validation },
    deck,
    modals: { setOpenDialog },
  } = useDeckEditorContext();
  const target = deckTarget(deck.format);
  const cardCount =
    validation?.card_count ??
    deck.cardsets
      .filter((card) => card.zone !== "considering")
      .reduce((total, card) => total + card.quantity, 0);
  const valid = validation?.valid === true;
  const colors = identityColors(deck.cardsets);
  const specialCards = deck.cardsets.filter(
    (card) => card.zone === "commander" || card.zone === "companion",
  );
  const previewIsSpecial =
    previewCard !== null &&
    specialCards.some((card) => card.id === previewCard.id);
  return (
    <Rail
      as={contained ? "section" : "aside"}
      contained={contained}
      id={DECK_SUMMARY_ID}
      label="Deck summary"
    >
      {specialCards.map((card) => (
        <Stack gap={1} key={card.id}>
          <Inline align="center" gap={1}>
            <Kicker>
              {card.zone === "commander" ? "Commander" : "Companion"}
            </Kicker>
            <FlexSpacer />
            <CardTagPicker card={card} />
          </Inline>
          <ClickableCardImage card={card} size="preview" />
        </Stack>
      ))}
      {previewCard === null && specialCards.length === 0 ? (
        <Art label="Card preview" rounded size="lg" />
      ) : null}
      {previewCard !== null && !previewIsSpecial && (
        <Stack gap={1}>
          <Kicker>Preview</Kicker>
          <ClickableCardImage card={previewCard} size="preview" />
        </Stack>
      )}
      <Inline gap={1} wrap>
        {zonesFor(deck.format).map((zone) => (
          <Chip
            count={deck.cardsets
              .filter((card) => card.zone === zone)
              .reduce((total, card) => total + card.quantity, 0)}
            key={zone}
          >
            {zoneLabel(zone)}
          </Chip>
        ))}
      </Inline>
      <MeterPanel
        label="Deck completion"
        max={target}
        tone={cardCount >= target ? "accent2" : "accent"}
        value={cardCount}
      />
      <Stack gap={1}>
        <Kicker>Mana curve</Kicker>
        <CurveBars
          label="Mana curve"
          labels={CURVE_LABELS}
          values={curveValues(deck.cardsets)}
        />
      </Stack>
      {colors.length > 0 && (
        <Stack gap={1}>
          <Kicker>Color identity</Kicker>
          <ColorIdentityRow colors={colors} />
        </Stack>
      )}
      <FlexSpacer />
      <Chip
        icon={
          valid ? (
            <CircleCheck size={14} strokeWidth={2.75} />
          ) : (
            <CircleAlert size={14} strokeWidth={2.75} />
          )
        }
        onClick={() => {
          setOpenDialog("validation");
        }}
        title="Open validation report"
      >
        {valid
          ? `Legal · ${String(cardCount)} / ${String(target)}`
          : `${String(validation?.errors.length ?? 0)} validation issues`}
      </Chip>
    </Rail>
  );
}
