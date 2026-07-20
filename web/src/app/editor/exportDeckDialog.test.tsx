import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CardSet, CardZone, Deck } from "../../modules/decks/contracts";
import {
  ExportDeckDialog,
  exportableZones,
  formatZoneDecklist,
} from "./exportDeckDialog";

const tags = [
  { id: "ramp", name: "Ramp", position: 0, target: 0 },
  { id: "mill", name: "Mill", position: 1, target: 0 },
  { id: "payoff", name: "Card Advantage", position: 2, target: 0 },
];

function card(
  id: string,
  name: string,
  quantity: number,
  zone: CardZone,
  tagIds: string[],
): CardSet {
  return {
    card_name: name,
    collector_number: "999",
    id,
    quantity,
    set_code: "tst",
    tag_ids: tagIds,
    tags: [],
    zone,
  } as unknown as CardSet;
}

const deck = {
  cardsets: [
    card("forest", "Forest", 3, "mainboard", []),
    card("aftermath", "Aftermath Analyst", 1, "mainboard", ["ramp", "mill"]),
    card("commander", "Muldrotha, the Gravetide", 1, "commander", ["payoff"]),
  ],
  tags,
} as unknown as Deck;

afterEach(cleanup);

describe("ExportDeckDialog", () => {
  it("formats each populated zone with only quantity, name, and verbatim tags", () => {
    expect(exportableZones(deck)).toEqual(["commander", "mainboard"]);
    expect(formatZoneDecklist(deck, "mainboard")).toBe(
      ["1 Aftermath Analyst #Mill #Ramp", "3 Forest"].join("\n"),
    );
    expect(formatZoneDecklist(deck, "commander")).toBe(
      "1 Muldrotha, the Gravetide #Card Advantage",
    );
    expect(formatZoneDecklist(deck, "mainboard")).not.toContain("TST");
    expect(formatZoneDecklist(deck, "mainboard")).not.toContain("999");
  });

  it("copies an individual zone decklist", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<ExportDeckDialog deck={deck} onClose={vi.fn()} />);

    const mainboard = screen.getByRole("textbox", {
      name: "Mainboard decklist",
    });
    expect(mainboard.getAttribute("readonly")).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Copy Mainboard decklist" }),
    );

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "1 Aftermath Analyst #Mill #Ramp\n3 Forest",
      );
    });
    expect(await screen.findByText("Copied Mainboard decklist.")).toBeTruthy();
  });
});
