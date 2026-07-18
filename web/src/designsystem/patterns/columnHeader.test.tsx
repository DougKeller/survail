import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ColumnHeader } from "./columnHeader";

afterEach(cleanup);

describe("ColumnHeader", () => {
  it("renders an h5 title with a count", () => {
    const { container } = render(<ColumnHeader count={11} title="Ramp" />);
    const title = screen.getByRole("heading", { level: 5, name: "Ramp" });
    expect(title.classList.contains("ds-column-header-title")).toBe(true);
    expect(
      container.querySelector(".ds-column-header-count")?.textContent,
    ).toBe("11");
  });

  it("renders a trailing slot after a spacer", () => {
    const { container } = render(
      <ColumnHeader title="Ramp">
        <button type="button">menu</button>
      </ColumnHeader>,
    );
    expect(container.querySelector(".ds-column-header-spacer")).not.toBeNull();
    expect(screen.getByRole("button", { name: "menu" })).toBeDefined();
  });

  it("applies the accent drop-target tone", () => {
    const { container } = render(
      <ColumnHeader tone="accent" title="Card Advantage" />,
    );
    expect(container.querySelector(".ds-column-header-accent")).not.toBeNull();
  });
});
