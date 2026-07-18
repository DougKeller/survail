import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Chip } from "./chip";

afterEach(cleanup);

describe("Chip", () => {
  it("renders a static span pill by default", () => {
    const { container } = render(<Chip>Mainboard</Chip>);
    const chip = container.firstElementChild;
    expect(chip?.tagName).toBe("SPAN");
    expect(chip?.className).toBe("ds-chip");
    expect(chip?.textContent).toBe("Mainboard");
  });

  it("renders icon and count slots", () => {
    const { container } = render(
      <Chip count={99} icon={<svg data-testid="icon" />}>
        Mainboard
      </Chip>,
    );
    const icon = screen.getByTestId("icon").parentElement;
    expect(icon?.className).toBe("ds-chip-icon");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    const count = container.querySelector("b.ds-chip-count");
    expect(count?.textContent).toBe("99");
  });

  it("becomes a button when onClick is given", () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>Considering</Chip>);
    const button = screen.getByRole("button", { name: "Considering" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toBe("ds-chip");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("merges custom class names", () => {
    const { container } = render(<Chip className="extra">x</Chip>);
    expect(container.firstElementChild?.className).toBe("ds-chip extra");
  });
});
