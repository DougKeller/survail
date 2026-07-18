import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImageButton, ImageFallback } from "./imageButton";

afterEach(cleanup);

describe("ImageButton", () => {
  it("renders a labelled button when interactive", () => {
    const onClick = vi.fn();
    render(
      <ImageButton label="View details for Lightning Bolt" onClick={onClick}>
        <img alt="" src="art.jpg" />
      </ImageButton>,
    );
    const button = screen.getByRole("button", {
      name: "View details for Lightning Bolt",
    });
    expect(button.classList.contains("ds-image-button")).toBe(true);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a plain frame with a size class when not interactive", () => {
    render(
      <ImageButton size="thumb">
        <img alt="Lightning Bolt" src="art.jpg" />
      </ImageButton>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    const frame = screen.getByAltText("Lightning Bolt").parentElement;
    expect(frame?.classList.contains("ds-image-button-thumb")).toBe(true);
  });
});

describe("ImageFallback", () => {
  it("renders the no-art tile", () => {
    render(<ImageFallback>Lightning Bolt</ImageFallback>);
    const tile = screen.getByText("Lightning Bolt");
    expect(tile.classList.contains("ds-image-fallback")).toBe(true);
  });
});
