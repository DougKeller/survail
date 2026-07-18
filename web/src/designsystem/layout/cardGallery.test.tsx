import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  CardStack,
  ImageGrid,
  StackColumns,
  StackSection,
} from "./cardGallery";

afterEach(cleanup);

describe("ImageGrid", () => {
  it("renders the auto-fill tile grid", () => {
    render(
      <ImageGrid>
        <span>tile</span>
      </ImageGrid>,
    );
    const grid = screen.getByText("tile").parentElement;
    expect(grid?.classList.contains("ds-image-grid")).toBe(true);
    expect(grid?.classList.contains("ds-image-grid-sm")).toBe(false);
  });

  it("supports the dense thumbnail variant", () => {
    render(
      <ImageGrid min="sm">
        <span>thumb</span>
      </ImageGrid>,
    );
    const grid = screen.getByText("thumb").parentElement;
    expect(grid?.classList.contains("ds-image-grid-sm")).toBe(true);
  });
});

describe("StackColumns", () => {
  it("nests unbreakable sections with overlapping stacks", () => {
    render(
      <StackColumns>
        <StackSection>
          <h3>Creature</h3>
          <CardStack>
            <div>card</div>
          </CardStack>
        </StackSection>
      </StackColumns>,
    );
    const section = screen.getByRole("heading", {
      name: "Creature",
    }).parentElement;
    expect(section?.classList.contains("ds-stack-section")).toBe(true);
    expect(section?.parentElement?.classList.contains("ds-stack-columns")).toBe(
      true,
    );
    expect(
      screen
        .getByText("card")
        .parentElement?.classList.contains("ds-card-stack"),
    ).toBe(true);
  });
});
