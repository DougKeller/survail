import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CardRow } from "./cardRow";

afterEach(cleanup);

describe("CardRow", () => {
  it("renders a static pill row with qty, grip, and trailing slot", () => {
    const { container } = render(
      <CardRow grip name="Sol Ring" qty={1}>
        <span>pip</span>
      </CardRow>,
    );
    const row = container.querySelector("div.ds-card-row");
    expect(row).not.toBeNull();
    expect(container.querySelector(".ds-card-row-grip")).not.toBeNull();
    expect(container.querySelector(".ds-card-row-qty")?.textContent).toBe("1");
    expect(container.querySelector(".ds-card-row-name")?.textContent).toBe(
      "Sol Ring",
    );
    expect(row?.textContent).toContain("pip");
  });

  it("applies tone and emphasis variants", () => {
    const { container } = render(
      <CardRow emphasis name="Counterspell" tone="accent" />,
    );
    const row = container.querySelector(".ds-card-row");
    expect(row?.classList.contains("ds-card-row-accent")).toBe(true);
    expect(
      container.querySelector(".ds-card-row-name.ds-card-row-emphasis"),
    ).not.toBeNull();
  });

  it("places an interactive move control at the far left", () => {
    const { container } = render(
      <CardRow
        leadingAction={<button type="button">Move</button>}
        name="Counterspell"
        qty={2}
      />,
    );
    const row = container.querySelector(".ds-card-row");

    expect(row?.firstElementChild?.className).toBe(
      "ds-card-row-leading-action",
    );
    expect(row?.firstElementChild?.textContent).toBe("Move");
  });

  it("renders a button when interactive and fires onClick", () => {
    const onClick = vi.fn();
    render(<CardRow interactive name="Cultivate" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Cultivate" });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a link when href is given", () => {
    render(<CardRow href="#card" name="Rhystic Study" tone="accent-2" />);
    const link = screen.getByRole("link", { name: "Rhystic Study" });
    expect(link.getAttribute("href")).toBe("#card");
    expect(link.classList.contains("ds-card-row-accent-2")).toBe(true);
  });
});
