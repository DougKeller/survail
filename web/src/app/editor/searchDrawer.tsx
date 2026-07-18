import { Plus } from "lucide-react";

import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type { ScryfallCard } from "../../modules/cards/contracts";
import type { CardZone } from "../../modules/decks/contracts";
import { IconButton } from "../../designsystem/primitives/button";
import { ManaCost } from "../../designsystem/primitives/pip";
import { Notice } from "../../designsystem/primitives/notice";
import { Popover } from "../../designsystem/primitives/popover";
import { Text } from "../../designsystem/layout/typography";
import { CardRow } from "../../designsystem/patterns/cardRow";

function addZoneLabel(zone: CardZone): string {
  return zone === "commander"
    ? "Commander"
    : zone.charAt(0).toUpperCase() + zone.slice(1);
}

export function SearchDrawer({
  addResult,
  busy,
  results,
  targetZone,
}: {
  addResult: (card: ScryfallCard) => void;
  busy: boolean;
  results: ScryfallCard[];
  targetZone: CardZone;
}) {
  return (
    <Popover align="stretch" label="Search results">
      {results.length === 0 ? (
        <Notice role="status">No cards matched this search.</Notice>
      ) : (
        results.slice(0, 60).map((card) => (
          <CardRow
            key={card.id}
            leading={<ClickableCardImage card={card} />}
            name={card.name}
          >
            <ManaCost cost={card.mana_cost} />
            <Text as="span" muted size="2xs">
              {card.set.toUpperCase()}
            </Text>
            <IconButton
              disabled={busy}
              label={`Add ${card.name} to ${addZoneLabel(targetZone)}`}
              onClick={() => {
                addResult(card);
              }}
              size="sm"
              variant="ghost"
            >
              <Plus size={15} strokeWidth={2.75} />
            </IconButton>
          </CardRow>
        ))
      )}
    </Popover>
  );
}
