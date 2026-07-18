import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CurveBars } from "./curve";

afterEach(cleanup);

describe("CurveBars", () => {
  it("renders one labeled column per value under an img role", () => {
    render(
      <CurveBars
        labels={["0", "1", "2", "3", "4", "5+"]}
        values={[3, 8, 10, 6, 4, 2]}
      />,
    );
    const chart = screen.getByRole("img", { name: "Mana curve" });
    expect(chart.querySelectorAll(".ds-curve-col")).toHaveLength(6);
    expect(chart.textContent).toBe("012345+");
  });

  it("gives the tallest bar full height and the accent emphasis tone", () => {
    const { container } = render(<CurveBars values={[1, 10]} />);
    const bars = container.querySelectorAll(".ds-curve-bar");
    expect(bars[1]?.classList.contains("ds-curve-bar-h10")).toBe(true);
    expect(bars[1]?.classList.contains("ds-curve-bar-t4")).toBe(true);
    expect(bars[0]?.classList.contains("ds-curve-bar-h1")).toBe(true);
    expect(bars[0]?.classList.contains("ds-curve-bar-t1")).toBe(true);
  });

  it("keeps zero and empty-deck buckets at the floor height", () => {
    const { container } = render(<CurveBars values={[0, 0]} />);
    const bars = container.querySelectorAll(".ds-curve-bar");
    expect(bars[0]?.classList.contains("ds-curve-bar-h0")).toBe(true);
    expect(bars[1]?.classList.contains("ds-curve-bar-h0")).toBe(true);
  });
});
