import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TooltipSurface } from "./tooltip";

afterEach(cleanup);

describe("TooltipSurface", () => {
  it("renders a tooltip-role span with the surface class", () => {
    render(
      <TooltipSurface>
        <img alt="" src="data:image/gif;base64," />
      </TooltipSurface>,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.tagName).toBe("SPAN");
    expect(tooltip.className).toBe("ds-tooltip-surface");
  });

  it("merges custom classes and forwards props", () => {
    render(<TooltipSurface className="extra" data-x="1" />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toBe("ds-tooltip-surface extra");
    expect(tooltip.getAttribute("data-x")).toBe("1");
  });
});
