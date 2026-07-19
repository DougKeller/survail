import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, Fragment } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CardSet } from "../../modules/decks/contracts";
import { CardZoneDragProvider, useCardZoneDrag } from "./cardZoneDrag";
import { nextDropZone } from "./cardZoneDropTargets";

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
        "data-testid": "tag-column",
        ...drag.tagColumnProps("tag-2"),
      }),
    ),
  );
}

describe("tag column drop targets", () => {
  it("adds the target tag without committing a row movement", () => {
    const moveCard = vi.fn();
    const tagCard = vi.fn();
    const card = {
      id: "cardset-1",
      card_name: "Sol Ring",
      scryfall: { card_faces: [], image_uris: null },
      zone: "mainboard",
    } as unknown as CardSet;
    render(
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

    fireEvent.dragStart(screen.getByTestId("card"), { dataTransfer: transfer });
    fireEvent.dragOver(screen.getByTestId("tag-column"), {
      dataTransfer: transfer,
    });
    fireEvent.drop(screen.getByTestId("tag-column"), {
      dataTransfer: transfer,
    });

    expect(tagCard).toHaveBeenCalledWith(card, "tag-2");
    expect(moveCard).not.toHaveBeenCalled();
  });
});
