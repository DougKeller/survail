import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FlexSpacer, Inline } from "./inline";

afterEach(cleanup);

describe("Inline", () => {
  it("renders defaults: gap 2, center alignment, start justification", () => {
    const { container } = render(<Inline>x</Inline>);
    const row = container.firstElementChild;
    expect(row?.className).toBe(
      "ds-inline ds-inline-gap-2 ds-inline-align-center ds-inline-justify-start",
    );
  });

  it("applies wrap, justify, and align variants", () => {
    const { container } = render(
      <Inline align="baseline" gap={4} justify="between" wrap>
        x
      </Inline>,
    );
    const row = container.firstElementChild;
    expect(row?.classList.contains("ds-inline-wrap")).toBe(true);
    expect(row?.classList.contains("ds-inline-gap-4")).toBe(true);
    expect(row?.classList.contains("ds-inline-align-baseline")).toBe(true);
    expect(row?.classList.contains("ds-inline-justify-between")).toBe(true);
  });
});

describe("FlexSpacer", () => {
  it("renders a hidden flexible span", () => {
    const { container } = render(<FlexSpacer />);
    const spacer = container.firstElementChild;
    expect(spacer?.classList.contains("ds-spacer")).toBe(true);
    expect(spacer?.getAttribute("aria-hidden")).toBe("true");
  });
});
