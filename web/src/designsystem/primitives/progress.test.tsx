import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Meter, meterFraction } from "./progress";

afterEach(cleanup);

describe("meterFraction", () => {
  it("computes the fill fraction", () => {
    expect(meterFraction(58, 75)).toBeCloseTo(58 / 75);
  });

  it("clamps to the 0..1 range", () => {
    expect(meterFraction(120, 99)).toBe(1);
    expect(meterFraction(-3, 99)).toBe(0);
  });

  it("treats a non-positive max as empty", () => {
    expect(meterFraction(10, 0)).toBe(0);
  });
});

describe("Meter", () => {
  it("exposes progressbar semantics", () => {
    render(<Meter label="Deck completion" max={99} value={58} />);
    const meter = screen.getByRole("progressbar", {
      name: "Deck completion",
    });
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("99");
    expect(meter.getAttribute("aria-valuenow")).toBe("58");
    expect(meter.className).toBe("ds-meter");
    expect(meter.querySelector(".ds-meter-fill")).not.toBeNull();
  });

  it("applies tone and size classes", () => {
    render(<Meter size="sm" tone="accent2" value={99} />);
    expect(screen.getByRole("progressbar").className).toBe(
      "ds-meter ds-meter-accent-2 ds-meter-sm",
    );
  });

  it("defaults max to 100", () => {
    render(<Meter value={40} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuemax")).toBe(
      "100",
    );
  });
});
