import { cleanup, render, screen } from "@testing-library/react";
import type { CSSProperties } from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
  GroupTile,
  ImageTile,
  ImageTileActions,
  ImageTileBadge,
} from "./imageTile";

afterEach(cleanup);

describe("ImageTile", () => {
  it("positions badges and the action cluster over the artwork", () => {
    render(
      <ImageTile>
        <img alt="Lightning Bolt" src="art.jpg" />
        <ImageTileBadge aria-label="3 copies">×3</ImageTileBadge>
        <ImageTileBadge
          aria-label="82 role score"
          corner="bottom-right"
          tone="accent"
        >
          82
        </ImageTileBadge>
        <ImageTileActions>
          <button type="button">Remove</button>
        </ImageTileActions>
      </ImageTile>,
    );
    const quantity = screen.getByLabelText("3 copies");
    expect(quantity.classList.contains("ds-image-tile-badge-top")).toBe(true);
    expect(quantity.classList.contains("ds-image-tile-badge-ink")).toBe(true);
    const score = screen.getByLabelText("82 role score");
    expect(score.classList.contains("ds-image-tile-badge-bottom")).toBe(true);
    expect(score.classList.contains("ds-image-tile-badge-accent")).toBe(true);
    const actions = screen.getByRole("button", {
      name: "Remove",
    }).parentElement;
    expect(actions?.classList.contains("ds-image-tile-actions")).toBe(true);
  });
});

describe("GroupTile", () => {
  it("renders eyebrow, title, and count with the accent custom property", () => {
    render(
      <GroupTile
        aria-label="Creature group with 12 cards"
        count="12 cards"
        eyebrow="Card type"
        style={{ "--ds-group-accent": "#ff0000" } as CSSProperties}
        title="Creature"
      />,
    );
    const tile = screen.getByRole("article", {
      name: "Creature group with 12 cards",
    });
    expect(tile.classList.contains("ds-group-tile")).toBe(true);
    expect(tile.style.getPropertyValue("--ds-group-accent")).toBe("#ff0000");
    expect(tile.textContent).toContain("Card type");
    expect(tile.textContent).toContain("Creature");
    expect(tile.textContent).toContain("12 cards");
  });
});
