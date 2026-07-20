import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type {
  CardSet,
  CardZone,
  Deck,
  DeckTag,
} from "../../modules/decks/contracts";
import { tagSwatches } from "./groupColors";
import {
  DeckTagsView,
  tagDeckRows,
  UNTAGGED_FILTER_ID,
} from "./tagsView";

const tags: DeckTag[] = [
  { id: "alpha", name: "Alpha", position: 2, target: 0 },
  { id: "beta", name: "Beta", position: 0, target: 0 },
  { id: "zeta", name: "Zeta", position: 1, target: 0 },
];

function card(
  id: string,
  name: string,
  tagIds: string[],
  zone: CardZone = "mainboard",
): CardSet {
  return {
    card_name: name,
    id,
    note: "",
    quantity: 1,
    tag_ids: tagIds,
    tags: [],
    zone,
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
    card("two", "Two Card", ["beta"], "sideboard"),
    card("three", "Three Card", ["zeta"]),
    card("untagged", "Untagged Card", []),
  ],
  tags,
} as unknown as Deck;

function renderView() {
  const changeQuantity = vi.fn();
  const editCardNote = vi.fn();
  const rendered = render(
    <MemoryRouter initialEntries={["/decks/deck-1?tab=tags"]}>
      <DeckTagsView
        busy={false}
        changeQuantity={changeQuantity}
        deck={deck}
        editCardNote={editCardNote}
        tagAction={() => null}
      />
    </MemoryRouter>,
  );
  return { ...rendered, changeQuantity, editCardNote };
}

describe("DeckTagsView", () => {
  it("sorts by visible tag count and filters selected tags with OR semantics", () => {
    expect(
      tagDeckRows(
        deck,
        ["alpha", "beta", "zeta"],
        ["alpha", "beta", "zeta", UNTAGGED_FILTER_ID],
        ["mainboard", "sideboard"],
        {
          direction: "desc",
          key: "tags",
        },
      ).map((row) => row.card.card_name),
    ).toEqual(["One Card", "Three Card", "Two Card", "Untagged Card"]);
    expect(
      tagDeckRows(
        deck,
        ["alpha", "beta"],
        ["alpha", "beta", "zeta", UNTAGGED_FILTER_ID],
        ["mainboard", "sideboard"],
        {
          direction: "desc",
          key: "tags",
        },
      ).map((row) => row.card.card_name),
    ).toEqual(["One Card", "Two Card", "Three Card", "Untagged Card"]);
    expect(
      tagDeckRows(
        deck,
        ["alpha", "beta", "zeta"],
        ["alpha", "beta"],
        ["mainboard", "sideboard"],
        {
          direction: "asc",
          key: "name",
        },
      ).map((row) => row.card.card_name),
    ).toEqual(["One Card", "Two Card"]);
    expect(
      tagDeckRows(
        deck,
        ["alpha", "beta", "zeta"],
        ["alpha", "beta", "zeta", UNTAGGED_FILTER_ID],
        ["sideboard"],
        { direction: "asc", key: "name" },
      ).map((row) => row.card.card_name),
    ).toEqual(["Two Card"]);
  });

  it("shows alphabetical, chart-colored chips and interactive tag filters", () => {
    renderView();
    expect(screen.getAllByRole("row")).toHaveLength(5);
    const oneRow = screen.getByRole("row", { name: /One Card/ });
    const chips = oneRow.querySelectorAll<HTMLElement>(".ds-chip-accent");
    expect([...chips].map((chip) => chip.textContent)).toEqual(["Alpha", "Zeta"]);
    const colors = tagSwatches(tags.map((tag) => tag.id));
    expect(chips[0]?.style.getPropertyValue("--ds-chip-accent")).toBe(
      colors.get("alpha"),
    );

    const filterMenu = screen
      .getByText("Filter cards · match any")
      .closest("details");
    if (filterMenu === null) throw new Error("Tag filter menu was not rendered");
    expect(within(filterMenu).getByText("4/4")).toBeTruthy();
    fireEvent.click(within(filterMenu).getByText("Filter cards · match any"));
    fireEvent.click(
      within(filterMenu).getByRole("button", { name: "Select none" }),
    );
    expect(screen.getAllByRole("row")).toHaveLength(1);
    fireEvent.click(
      within(filterMenu).getByRole("checkbox", { name: "Alpha" }),
    );
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.click(
      within(filterMenu).getByRole("checkbox", { name: "Beta" }),
    );
    expect(screen.getAllByRole("row")).toHaveLength(3);
    fireEvent.click(
      within(filterMenu).getByRole("checkbox", { name: "Untagged" }),
    );
    expect(screen.getAllByRole("row")).toHaveLength(4);
    fireEvent.click(
      within(filterMenu).getByRole("button", { name: "Select all" }),
    );
    expect(screen.getAllByRole("row")).toHaveLength(5);

    const zones = screen.getByRole("group", { name: /Zones/ });
    fireEvent.click(within(zones).getByRole("button", { name: "Select none" }));
    expect(screen.getAllByRole("row")).toHaveLength(1);
    fireEvent.click(
      within(zones).getByRole("checkbox", { name: "Sideboard" }),
    );
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("row", { name: /Two Card/ })).toBeTruthy();
    fireEvent.click(within(zones).getByRole("button", { name: "Select all" }));

    const shownTagsMenu = screen.getByText("Shown tags").closest("details");
    if (shownTagsMenu === null)
      throw new Error("Shown tags menu was not rendered");
    fireEvent.click(screen.getByText("Shown tags"));
    fireEvent.click(
      within(shownTagsMenu).getByRole("checkbox", { name: "Alpha" }),
    );
    expect(
      within(screen.getByRole("row", { name: /One Card/ })).queryByText(
        "Alpha",
      ),
    ).toBeNull();
  });

  it("exposes note and quantity actions for every card row", () => {
    const { changeQuantity, container, editCardNote } = renderView();
    const view = within(container);
    expect(view.getByRole("columnheader", { name: "Actions" })).toBeTruthy();

    fireEvent.click(
      view.getByRole("button", { name: "Add note for One Card" }),
    );
    expect(editCardNote).toHaveBeenCalledWith(deck.cardsets[0]);

    fireEvent.click(view.getByRole("button", { name: "Add one One Card" }));
    expect(changeQuantity).toHaveBeenCalledWith(deck.cardsets[0], 1);
    fireEvent.click(
      view.getByRole("button", { name: "Remove one One Card" }),
    );
    expect(changeQuantity).toHaveBeenCalledWith(deck.cardsets[0], -1);
  });
});
