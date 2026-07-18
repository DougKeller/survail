import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RangeBand } from "./rangeBand";

afterEach(cleanup);

describe("RangeBand", () => {
  it("describes the allowed range and score accessibly", () => {
    render(<RangeBand high={92} label="Mana Ramp score" low={68} value={80} />);
    expect(
      screen.getByRole("img", {
        name: "Mana Ramp score: scored 80, allowed 68 to 92",
      }),
    ).toBeDefined();
  });

  it("renders the band without a marker when no value is given", () => {
    const { container } = render(
      <RangeBand high={90} label="Overall score" low={70} />,
    );
    expect(container.querySelector(".ds-range-band-marker")).toBeNull();
    expect(container.querySelector(".ds-range-band-allowed")).not.toBeNull();
    expect(
      screen.getByRole("img", { name: "Overall score: allowed 70 to 90" }),
    ).toBeDefined();
  });

  it("positions the band and marker on the 0..max scale", () => {
    const { container } = render(
      <RangeBand high={75} label="Score" low={25} max={100} value={50} />,
    );
    const allowed = container.querySelector(".ds-range-band-allowed");
    expect(allowed?.getAttribute("x")).toBe("25");
    expect(allowed?.getAttribute("width")).toBe("50");
    const marker = container.querySelector(".ds-range-band-marker");
    expect(marker?.getAttribute("x")).toBe("49");
  });

  it("keeps an out-of-scale marker on the track", () => {
    const { container } = render(
      <RangeBand high={60} label="Score" low={40} value={140} />,
    );
    const marker = container.querySelector(".ds-range-band-marker");
    expect(marker?.getAttribute("x")).toBe("98");
  });

  it("switches the marker tone for failures", () => {
    const { container } = render(
      <RangeBand high={60} label="Score" low={40} tone="fail" value={95} />,
    );
    expect(container.querySelector(".ds-range-band-fail")).not.toBeNull();
  });
});
