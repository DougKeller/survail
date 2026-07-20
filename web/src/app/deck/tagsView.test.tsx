import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { CardSet, Deck, DeckTag } from "../../modules/decks/contracts";
import { tagSwatches } from "./groupColors";
import { DeckTagsView, tagDeckRows } from "./tagsView";

const tags: DeckTag[] = [
  { id: "alpha", name: "Alpha", position: 2, target: 0 },
  { id: "beta", name: "Beta", position: 0, target: 0 },
  { id: "zeta", name: "Zeta", position: 1, target: 0 },
];

function card(id: string, name: string, tagIds: string[]): CardSet {
  return {
    card_name: name,
    id,
    quantity: 1,
    tag_ids: tagIds,
    tags: [],
    zone: "mainboard",
    scryfall: {
      card_faces: [],
      image_uris: { normal: null },
      name,
      type_line: "Creature",
    },
  } as unknown as CardSet;
}

const deck = {
  cardsets: [
    card("one", "One Card", ["zeta", "alpha"]),
    card("two", "Two Card", ["beta"]),
    card("three", "Three Card", ["zeta"]),
  ],
  tags,
} as unknown as Deck;

function renderView() {
  return render(
    <MemoryRouter initialEntries={["/decks/deck-1?tab=tags"]}>
      <DeckTagsView deck={deck} />
    </MemoryRouter>,
  );
}

describe("DeckTagsView", () => {
  it("sorts by visible tag count and filters selected tags with OR semantics", () => {
    expect(
      tagDeckRows(deck, ["alpha", "beta", "zeta"], [], {
        direction: "desc",
        key: "tags",
      }).map((row) => row.card.card_name),
    ).toEqual(["One Card", "Three Card", "Two Card"]);
    expect(
      tagDeckRows(deck, ["alpha", "beta"], [], {
        direction: "desc",
        key: "tags",
      }).map((row) => row.card.card_name),
    ).toEqual(["One Card", "Two Card", "Three Card"]);
    expect(
      tagDeckRows(deck, ["alpha", "beta", "zeta"], ["alpha", "beta"], {
        direction: "asc",
        key: "name",
      }).map((row) => row.card.card_name),
    ).toEqual(["One Card", "Two Card"]);
  });

  it("shows alphabetical, chart-colored chips and interactive tag filters", () => {
    renderView();
    const oneRow = screen.getByRole("row", { name: /One Card/ });
    const chips = oneRow.querySelectorAll<HTMLElement>(".ds-chip-accent");
    expect([...chips].map((chip) => chip.textContent)).toEqual(["Alpha", "Zeta"]);
    const colors = tagSwatches(tags.map((tag) => tag.id));
    expect(chips[0]?.style.getPropertyValue("--ds-chip-accent")).toBe(
      colors.get("alpha"),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Filter cards by Alpha" }),
    );
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: "Filter cards by Beta" }),
    );
    expect(screen.getAllByRole("row")).toHaveLength(3);
    fireEvent.click(
      screen.getByRole("button", { name: "Filter cards by Alpha" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Filter cards by Beta" }),
    );

    fireEvent.click(screen.getByText("Shown tags"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    expect(
      within(screen.getByRole("row", { name: /One Card/ })).queryByText(
        "Alpha",
      ),
    ).toBeNull();
  });
});
