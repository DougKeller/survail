import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BrandMark } from "./brandMark";

afterEach(cleanup);

describe("BrandMark", () => {
  it("renders a decorative accent tile with the default glyph", () => {
    const { container } = render(<BrandMark />);
    const mark = container.firstElementChild;
    expect(mark?.className).toBe("ds-brand-mark");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(mark?.querySelector("svg")).not.toBeNull();
  });

  it("accepts a custom glyph", () => {
    const { container } = render(
      <BrandMark>
        <svg data-testid="custom" />
      </BrandMark>,
    );
    expect(container.querySelector("[data-testid='custom']")).not.toBeNull();
  });
});
