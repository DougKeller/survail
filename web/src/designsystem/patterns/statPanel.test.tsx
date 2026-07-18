import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MeterPanel } from "./statPanel";

afterEach(cleanup);

describe("MeterPanel", () => {
  it("renders kicker, formatted reading, and a meter", () => {
    render(<MeterPanel label="Deck completion" max={99} value={99} />);
    expect(screen.getByText("Deck completion").className).toContain(
      "ds-kicker",
    );
    expect(screen.getByText("99 / 99").className).toBe("ds-meter-panel-value");
    expect(
      screen.getByRole("progressbar", { name: "Deck completion" }),
    ).toBeDefined();
  });

  it("switches the reading tone with the meter tone", () => {
    const { container } = render(
      <MeterPanel label="Drafting" max={75} tone="accent" value={58} />,
    );
    expect(container.querySelector(".ds-meter-panel-accent")).not.toBeNull();
  });

  it("accepts a custom value text", () => {
    render(
      <MeterPanel label="Progress" max={75} value={58} valueText="58 of 75" />,
    );
    expect(screen.getByText("58 of 75")).toBeDefined();
  });
});
