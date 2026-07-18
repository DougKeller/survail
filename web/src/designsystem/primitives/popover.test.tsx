import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Popover, PopoverAnchor } from "./popover";

afterEach(cleanup);

describe("PopoverAnchor", () => {
  it("provides a relative positioning context with an optional grow variant", () => {
    const { container } = render(
      <PopoverAnchor grow>
        <button type="button">anchor</button>
      </PopoverAnchor>,
    );
    const anchor = container.firstElementChild;
    expect(anchor?.classList.contains("ds-popover-anchor")).toBe(true);
    expect(anchor?.classList.contains("ds-popover-anchor-grow")).toBe(true);
  });
});

describe("Popover", () => {
  it("exposes role=dialog when labeled", () => {
    render(<Popover label="Search results">rows</Popover>);
    const dialog = screen.getByRole("dialog", { name: "Search results" });
    expect(dialog.classList.contains("ds-popover")).toBe(true);
    expect(dialog.classList.contains("ds-popover-start")).toBe(true);
  });

  it("stays presentational without a label and applies alignment", () => {
    const { container } = render(<Popover align="stretch">rows</Popover>);
    const popover = container.firstElementChild;
    expect(popover?.getAttribute("role")).toBeNull();
    expect(popover?.classList.contains("ds-popover-stretch")).toBe(true);
  });
});
