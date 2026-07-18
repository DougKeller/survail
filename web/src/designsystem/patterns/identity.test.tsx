import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ColorIdentityRow } from "./identity";

afterEach(cleanup);

describe("ColorIdentityRow", () => {
  it("renders one pip per color under a labeled img role", () => {
    render(<ColorIdentityRow colors={["W", "U", "B", "R", "G"]} />);
    const row = screen.getByRole("img", { name: "Color identity" });
    expect(row.classList.contains("ds-identity-row")).toBe(true);
    expect(row.childElementCount).toBe(5);
  });

  it("accepts a custom label", () => {
    render(<ColorIdentityRow colors={["G"]} label="Deck colors" />);
    expect(screen.getByRole("img", { name: "Deck colors" })).toBeDefined();
  });
});
