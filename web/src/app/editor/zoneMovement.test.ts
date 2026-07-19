import { describe, expect, it } from "vitest";

import type { CardSet } from "../../modules/decks/contracts";
import {
  bulkMoveSummary,
  moveAllToConsideringChanges,
  moveOneChanges,
} from "./zoneMovement";

function card(overrides: Partial<CardSet> = {}): CardSet {
  return {
    id: "cardset-1",
    quantity: 3,
    zone: "mainboard",
    finish: "etched",
    printing_id: "printing-1",
    oracle_id: "oracle-1",
    card_name: "Sol Ring",
    set_code: "cmm",
    collector_number: "396",
    note: "Keep this printing",
    tags: ["ramp", "favorite"],
    scryfall: {} as CardSet["scryfall"],
    ...overrides,
  };
}

describe("moveOneChanges", () => {
  it("moves exactly one copy and preserves cardset metadata", () => {
    expect(moveOneChanges(card(), "considering")).toEqual([
      {
        printing_id: "printing-1",
        quantity_delta: -1,
        zone: "mainboard",
        finish: "etched",
        note: "Keep this printing",
        tags: ["ramp", "favorite"],
      },
      {
        printing_id: "printing-1",
        quantity_delta: 1,
        zone: "considering",
        finish: "etched",
        note: "Keep this printing",
        tags: ["ramp", "favorite"],
      },
    ]);
  });

  it("returns no changes for a no-op move", () => {
    expect(moveOneChanges(card(), "mainboard")).toEqual([]);
  });
});

describe("moveAllToConsideringChanges", () => {
  it("moves every quantity in the source zone in one change list", () => {
    const changes = moveAllToConsideringChanges(
      [
        card(),
        card({
          id: "cardset-2",
          card_name: "Arcane Signet",
          printing_id: "printing-2",
          quantity: 2,
          zone: "sideboard",
        }),
        card({
          id: "cardset-3",
          card_name: "Swords to Plowshares",
          printing_id: "printing-3",
          quantity: 1,
        }),
      ],
      "mainboard",
    );

    expect(changes).toHaveLength(4);
    expect(
      changes.map(({ printing_id, quantity_delta, zone }) => ({
        printing_id,
        quantity_delta,
        zone,
      })),
    ).toEqual([
      { printing_id: "printing-1", quantity_delta: -3, zone: "mainboard" },
      { printing_id: "printing-1", quantity_delta: 3, zone: "considering" },
      { printing_id: "printing-3", quantity_delta: -1, zone: "mainboard" },
      { printing_id: "printing-3", quantity_delta: 1, zone: "considering" },
    ]);
    expect(
      changes.every((change) => change.note === "Keep this printing"),
    ).toBe(true);
    expect(
      changes.every((change) => change.tags?.join() === "ramp,favorite"),
    ).toBe(true);
  });
});

describe("bulkMoveSummary", () => {
  it("reports unique cardsets and total quantity for confirmation copy", () => {
    expect(
      bulkMoveSummary(
        [
          card(),
          card({ id: "cardset-2", quantity: 2 }),
          card({ zone: "considering" }),
        ],
        "mainboard",
      ),
    ).toEqual({ uniqueCards: 2, totalQuantity: 5 });
  });
});
