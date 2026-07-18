import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Rail } from "./rail";

afterEach(cleanup);

describe("Rail", () => {
  it("renders a complementary landmark with a default label", () => {
    render(<Rail>panel</Rail>);
    const rail = screen.getByRole("complementary", { name: "Details" });
    expect(rail.classList.contains("ds-rail")).toBe(true);
    expect(rail.textContent).toBe("panel");
  });

  it("accepts a custom label", () => {
    render(<Rail label="Deck stats">panel</Rail>);
    expect(
      screen.getByRole("complementary", { name: "Deck stats" }),
    ).toBeDefined();
  });
});
