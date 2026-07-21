import { act, fireEvent, render, within } from "@testing-library/react";
import { createElement, Fragment } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CardSet } from "../../modules/decks/contracts";
import {
  CardZoneDragProvider,
  useCardZoneDrag,
  useOptionalCardZoneDragStatic,
} from "./cardZoneDrag";
import { nextDropZone } from "./cardZoneDropTargets";
import { CREATE_TAG_DROP_ID } from "./cardZoneDragTypes";

describe("nextDropZone", () => {
  const zones = ["mainboard", "sideboard", "considering"] as const;

  it("moves through row targets and wraps", () => {
    expect(nextDropZone(zones, "mainboard", 1)).toBe("sideboard");
    expect(nextDropZone(zones, "considering", 1)).toBe("mainboard");
    expect(nextDropZone(zones, "mainboard", -1)).toBe("considering");
  });

  it("starts from the first or last row when no target is active", () => {
    expect(nextDropZone(zones, null, 1)).toBe("mainboard");
    expect(nextDropZone(zones, null, -1)).toBe("considering");
  });
});

function TagDragHarness({ card }: { card: CardSet }) {
  const drag = useCardZoneDrag();
  return createElement(
    Fragment,
    null,
    createElement("div", {
      "data-testid": "card",
      ...drag.draggableProps(card, "visual-1"),
    }),
    createElement(
      "div",
      { "data-testid": "row", ...drag.rowProps("considering") },
      createElement("div", {
        "data-testid": "destination-tag-column",
        ...drag.tagColumnProps("tag-2", "considering"),
      }),
    ),
    createElement("div", {
      "data-testid": "same-zone-tag-column",
      ...drag.tagColumnProps("tag-2", "mainboard"),
    }),
    createElement("div", {
      "data-testid": "new-tag-column",
      ...drag.tagColumnProps(CREATE_TAG_DROP_ID, "mainboard"),
    }),
  );
}

describe("tag column drop targets", () => {
  it("moves zones instead of adding a destination-row tag", () => {
    const moveCard = vi.fn();
    const tagCard = vi.fn();
    const card = {
      id: "cardset-1",
      card_name: "Sol Ring",
      quantity: 4,
      scryfall: { card_faces: [], image_uris: null },
      tag_ids: ["tag-1"],
      tags: ["Ramp"],
      zone: "mainboard",
    } as unknown as CardSet;
    const view = render(
      createElement(
        CardZoneDragProvider,
        {
          busy: false,
          moveCard,
          tagCard,
          zones: ["mainboard", "considering"],
        },
        createElement(TagDragHarness, { card }),
      ),
    );
    const transfer = {
      dropEffect: "none",
      effectAllowed: "none",
      setData: vi.fn(),
      setDragImage: vi.fn(),
    };
    const ui = within(view.container);

    fireEvent.dragStart(ui.getByTestId("card"), { dataTransfer: transfer });
    expect(transfer.effectAllowed).toBe("copyMove");
    fireEvent.dragOver(ui.getByTestId("destination-tag-column"), {
      dataTransfer: transfer,
    });
    expect(transfer.dropEffect).toBe("move");
    fireEvent.drop(ui.getByTestId("destination-tag-column"), {
      dataTransfer: transfer,
    });

    expect(moveCard).toHaveBeenCalledWith(card, "considering");
    expect(tagCard).not.toHaveBeenCalled();
    expect(card).toMatchObject({
      quantity: 4,
      tag_ids: ["tag-1"],
      tags: ["Ramp"],
      zone: "mainboard",
    });
  });

  it("adds a tag for a same-zone column drop", () => {
    const moveCard = vi.fn();
    const tagCard = vi.fn();
    const card = {
      id: "cardset-1",
      card_name: "Sol Ring",
      quantity: 2,
      scryfall: { card_faces: [], image_uris: null },
      tag_ids: ["tag-1"],
      tags: ["Ramp"],
      zone: "mainboard",
    } as unknown as CardSet;
    const view = render(
      createElement(
        CardZoneDragProvider,
        {
          busy: false,
          moveCard,
          tagCard,
          zones: ["mainboard", "considering"],
        },
        createElement(TagDragHarness, { card }),
      ),
    );
    const transfer = {
      dropEffect: "none",
      effectAllowed: "none",
      setData: vi.fn(),
      setDragImage: vi.fn(),
    };
    const cardElement = view.container.querySelector<HTMLElement>(
      '[data-testid="card"]',
    );
    const tagColumn = view.container.querySelector<HTMLElement>(
      '[data-testid="same-zone-tag-column"]',
    );
    expect(cardElement).not.toBeNull();
    expect(tagColumn).not.toBeNull();
    const dragStart = new Event("dragstart", { bubbles: true });
    const drop = new Event("drop", { bubbles: true });
    Object.defineProperty(dragStart, "dataTransfer", { value: transfer });
    Object.defineProperty(drop, "dataTransfer", { value: transfer });

    act(() => {
      cardElement?.dispatchEvent(dragStart);
      tagColumn?.dispatchEvent(drop);
    });

    expect(tagCard).toHaveBeenCalledOnce();
    expect(tagCard).toHaveBeenCalledWith(card, "tag-2");
    expect(moveCard).not.toHaveBeenCalled();
    expect(card).toMatchObject({
      quantity: 2,
      tag_ids: ["tag-1"],
      tags: ["Ramp"],
      zone: "mainboard",
    });
  });

  it("opens tag creation for the permanent same-zone extra column", () => {
    const createTagForCard = vi.fn();
    const card = {
      id: "cardset-1",
      card_name: "Sol Ring",
      quantity: 1,
      scryfall: { card_faces: [], image_uris: null },
      zone: "mainboard",
    } as unknown as CardSet;
    const view = render(
      createElement(
        CardZoneDragProvider,
        {
          busy: false,
          createTagForCard,
          moveCard: vi.fn(),
          tagCard: vi.fn(),
          zones: ["mainboard", "considering"],
        },
        createElement(TagDragHarness, { card }),
      ),
    );
    const transfer = {
      dropEffect: "none",
      effectAllowed: "none",
      setData: vi.fn(),
      setDragImage: vi.fn(),
    };
    const ui = within(view.container);

    fireEvent.dragStart(ui.getByTestId("card"), { dataTransfer: transfer });
    fireEvent.dragOver(ui.getByTestId("new-tag-column"), {
      dataTransfer: transfer,
    });
    fireEvent.drop(ui.getByTestId("new-tag-column"), {
      dataTransfer: transfer,
    });

    expect(createTagForCard).toHaveBeenCalledWith(card);
  });
});

describe("drag render isolation", () => {
  it("keeps full card consumers stable while drag feedback changes", () => {
    const card = {
      id: "cardset-1",
      card_name: "Sol Ring",
      scryfall: { card_faces: [], image_uris: null },
      zone: "mainboard",
    } as unknown as CardSet;
    const renderCard = vi.fn();
    const renderFeedback = vi.fn();

    function CardProbe() {
      const drag = useOptionalCardZoneDragStatic();
      renderCard();
      return createElement("div", {
        "data-testid": "isolated-card",
        ...drag?.draggableProps(card, "visual-1"),
      });
    }
    function FeedbackProbe() {
      const drag = useCardZoneDrag();
      renderFeedback();
      return createElement("span", null, drag.instruction);
    }

    const view = render(
      createElement(
        CardZoneDragProvider,
        {
          busy: false,
          moveCard: vi.fn(),
          zones: ["mainboard", "considering"],
        },
        createElement(
          Fragment,
          null,
          createElement(CardProbe),
          createElement(FeedbackProbe),
        ),
      ),
    );
    const transfer = {
      dropEffect: "none",
      effectAllowed: "none",
      setData: vi.fn(),
      setDragImage: vi.fn(),
    };

    fireEvent.dragStart(view.getByTestId("isolated-card"), {
      dataTransfer: transfer,
    });

    expect(renderCard).toHaveBeenCalledTimes(1);
    expect(renderFeedback.mock.calls.length).toBeGreaterThan(1);
  });
});
