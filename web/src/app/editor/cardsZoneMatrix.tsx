import { useContext, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { CardSet } from "../../modules/decks/contracts";
import type { CardZoneMatrixRowZone } from "../deck/cardZoneMatrix";
import {
  buildCardZoneMatrix,
  PriceProviderContext,
  storeCardRowCollapsed,
  storedCardRowCollapsed,
  zoneLabel,
} from "../deckPrimitives";
import { Button, IconButton } from "../../designsystem/primitives/button";
import { Inline } from "../../designsystem/layout/inline";
import {
  CardZoneColumns,
  CardZoneEmpty,
  CardZoneMatrixLayout,
  CardZoneRow,
  CardZoneRowHeader,
  CardZoneRowScroll,
  CardZoneRowTitle,
} from "../../designsystem/layout/cardZoneWorkspace";
import { Text } from "../../designsystem/layout/typography";
import { VisuallyHidden } from "../../designsystem/primitives/visuallyHidden";
import { useCardZoneDrag } from "./cardZoneDrag";
import { MoveAllConfirmationDialog } from "./moveAllConfirmationDialog";
import { bulkMoveSummary, type BulkMoveSource } from "./zoneMovement";
import { useDeckCardsContext } from "./deckEditorContext";
import { calculateRoleTargetProgress } from "../deck/roleTargets";
import { CardsZoneColumn } from "./cardsZoneColumn";
import { RoleQualityPicker } from "./roleTargetColumn";
import { useRoleTargets } from "./useRoleTargets";

type AuxiliaryRowZone = Exclude<CardZoneMatrixRowZone, "mainboard">;

function rowStartsCollapsed(
  cards: readonly CardSet[],
  zone: AuxiliaryRowZone,
): boolean {
  return !cards.some((card) => card.zone === zone && card.quantity > 0);
}

function MatrixRows({ onPreview }: { onPreview: (card: CardSet) => void }) {
  const {
    actions: { moveAllToConsidering },
    data: { busy },
    deck,
    display: { displayPreferences },
    scoring: { scores },
  } = useDeckCardsContext();
  const provider = useContext(PriceProviderContext);
  const drag = useCardZoneDrag();
  const [bulkSource, setBulkSource] = useState<BulkMoveSource | null>(null);
  const { changeRoleQuality, changeRoleTarget, roleTargets } = useRoleTargets(
    deck.id,
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => ({
    considering: storedCardRowCollapsed(
      deck.id,
      "considering",
      rowStartsCollapsed(deck.cardsets, "considering"),
    ),
    sideboard: storedCardRowCollapsed(
      deck.id,
      "sideboard",
      rowStartsCollapsed(deck.cardsets, "sideboard"),
    ),
  }));
  const matrix = useMemo(
    () =>
      buildCardZoneMatrix({
        cards: deck.cardsets,
        format: deck.format,
        deckTags: deck.tags ?? [],
        groupBy: displayPreferences.groupBy,
        provider,
        scores,
        sortBy: displayPreferences.sortBy,
      }),
    [
      deck.cardsets,
      deck.format,
      deck.tags,
      displayPreferences.groupBy,
      displayPreferences.sortBy,
      provider,
      scores,
    ],
  );
  const roleProgress = useMemo(
    () =>
      calculateRoleTargetProgress({
        cards: deck.cardsets,
        evaluations: scores,
        targets: roleTargets,
      }),
    [deck.cardsets, roleTargets, scores],
  );

  useEffect(() => {
    setCollapsed({
      considering: storedCardRowCollapsed(
        deck.id,
        "considering",
        rowStartsCollapsed(deck.cardsets, "considering"),
      ),
      sideboard: storedCardRowCollapsed(
        deck.id,
        "sideboard",
        rowStartsCollapsed(deck.cardsets, "sideboard"),
      ),
    });
  }, [deck.cardsets, deck.id]);

  useEffect(() => {
    const target = drag.activeTarget;
    if (target === null || target === "mainboard" || !collapsed[target]) return;
    setCollapsed((current) => ({ ...current, [target]: false }));
    storeCardRowCollapsed(deck.id, target, false);
  }, [collapsed, deck.id, drag.activeTarget]);

  const toggleRow = (zone: AuxiliaryRowZone) => {
    setCollapsed((current) => {
      const next = !current[zone];
      storeCardRowCollapsed(deck.id, zone, next);
      return { ...current, [zone]: next };
    });
  };
  const activeSummary =
    bulkSource === null ? null : bulkMoveSummary(deck.cardsets, bulkSource);

  return (
    <>
      <CardZoneMatrixLayout>
        {matrix.rows.map((row) => {
          const rowCollapsed =
            row.zone !== "mainboard" && collapsed[row.zone] === true;
          const headingId = `cards-row-${row.zone}-heading`;
          const contentId = `cards-row-${row.zone}-content`;
          const rowProps = drag.rowProps(row.zone);
          const bulkEligible =
            row.zone === "mainboard" || row.zone === "sideboard";
          return (
            <CardZoneRow
              {...rowProps}
              active={drag.activeTarget === row.zone}
              aria-labelledby={headingId}
              collapsed={rowCollapsed}
              key={row.zone}
            >
              <CardZoneRowHeader>
                <Inline align="center" gap={2}>
                  {row.zone !== "mainboard" && (
                    <IconButton
                      aria-controls={contentId}
                      aria-expanded={!rowCollapsed}
                      label={`${rowCollapsed ? "Expand" : "Collapse"} ${zoneLabel(row.zone)}`}
                      onClick={() => {
                        if (row.zone !== "mainboard") toggleRow(row.zone);
                      }}
                      variant="ghost"
                    >
                      {rowCollapsed ? (
                        <ChevronRight size={14} strokeWidth={2.75} />
                      ) : (
                        <ChevronDown size={14} strokeWidth={2.75} />
                      )}
                    </IconButton>
                  )}
                  <CardZoneRowTitle id={headingId}>
                    {zoneLabel(row.zone)}
                  </CardZoneRowTitle>
                  <Text as="span" muted size="sm">
                    {row.totalQuantity} cards · {row.distinctCardCount} unique
                  </Text>
                  {row.totalQuantity === 0 && (
                    <Text as="span" muted size="sm">
                      Drop a card here
                    </Text>
                  )}
                </Inline>
                {((row.zone === "mainboard" &&
                  displayPreferences.groupBy === "role") ||
                  (bulkEligible && row.totalQuantity > 0)) && (
                  <Inline align="center" gap={3}>
                    {row.zone === "mainboard" &&
                      displayPreferences.groupBy === "role" && (
                        <RoleQualityPicker
                          onChange={changeRoleQuality}
                          quality={roleTargets.quality}
                        />
                      )}
                    {bulkEligible && row.totalQuantity > 0 && (
                      <Button
                        disabled={busy}
                        onClick={() => {
                          if (
                            row.zone === "mainboard" ||
                            row.zone === "sideboard"
                          ) {
                            setBulkSource(row.zone);
                          }
                        }}
                        variant="ghost"
                      >
                        Move all to Considering
                      </Button>
                    )}
                  </Inline>
                )}
              </CardZoneRowHeader>
              <CardZoneRowScroll
                aria-label={`${zoneLabel(row.zone)} cards`}
                collapsed={rowCollapsed}
                id={contentId}
                role="region"
                zone={row.zone}
              >
                {matrix.columns.length === 0 ? (
                  <CardZoneEmpty>
                    <Text muted>No cards in this workspace.</Text>
                  </CardZoneEmpty>
                ) : (
                  <CardZoneColumns size={displayPreferences.columnSize}>
                    {row.columns.map((column) => (
                      <CardsZoneColumn
                        cards={column.cards}
                        key={
                          column.tagId === undefined
                            ? column.label
                            : `tag-${column.tagId ?? "untagged-fallback"}`
                        }
                        label={column.label}
                        onPreview={onPreview}
                        onRoleTargetChange={changeRoleTarget}
                        quantity={column.quantity}
                        roleProgress={roleProgress}
                        roleTargets={roleTargets}
                        tagId={column.tagId}
                        zone={row.zone}
                      />
                    ))}
                  </CardZoneColumns>
                )}
              </CardZoneRowScroll>
            </CardZoneRow>
          );
        })}
      </CardZoneMatrixLayout>
      <VisuallyHidden aria-live="polite">{drag.instruction}</VisuallyHidden>
      {bulkSource !== null && activeSummary !== null && (
        <MoveAllConfirmationDialog
          busy={busy}
          onCancel={() => {
            setBulkSource(null);
          }}
          onConfirm={() => {
            moveAllToConsidering(bulkSource);
            setCollapsed((current) => ({
              ...current,
              considering: false,
            }));
            storeCardRowCollapsed(deck.id, "considering", false);
            setBulkSource(null);
          }}
          open
          source={bulkSource}
          totalQuantity={activeSummary.totalQuantity}
          uniqueCards={activeSummary.uniqueCards}
        />
      )}
    </>
  );
}

export { MatrixRows };
