import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GhostTile } from "./emptyTile";

afterEach(cleanup);

describe("GhostTile", () => {
  it("renders a button tile with the heading-font label", () => {
    const onClick = vi.fn();
    render(<GhostTile label="New category" onClick={onClick} />);
    const tile = screen.getByRole("button", { name: "New category" });
    expect(tile.classList.contains("ds-ghost-tile")).toBe(true);
    fireEvent.click(tile);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a link when href is given", () => {
    render(<GhostTile href="#new" label="New deck" />);
    const tile = screen.getByRole("link", { name: "New deck" });
    expect(tile.getAttribute("href")).toBe("#new");
    expect(tile.querySelector(".ds-ghost-tile-label")?.textContent).toBe(
      "New deck",
    );
  });

  it("accepts a custom icon", () => {
    render(
      <GhostTile icon={<span data-testid="custom-icon" />} label="New deck" />,
    );
    expect(screen.getByTestId("custom-icon")).toBeDefined();
  });
});
