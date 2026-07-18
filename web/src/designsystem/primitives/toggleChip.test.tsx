import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToggleChip } from "./toggleChip";

afterEach(cleanup);

describe("ToggleChip", () => {
  it("renders a pressed neutral toggle button", () => {
    render(<ToggleChip pressed>Mana Ramp</ToggleChip>);
    const button = screen.getByRole("button", { name: "Mana Ramp" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.className).toBe(
      "ds-toggle-chip ds-toggle-chip-neutral ds-toggle-chip-on",
    );
  });

  it("reads as an addition with the positive tone", () => {
    render(
      <ToggleChip pressed tone="positive">
        Payoff
      </ToggleChip>,
    );
    const button = screen.getByRole("button", { name: "Payoff" });
    expect(button.classList.contains("ds-toggle-chip-positive")).toBe(true);
  });

  it("reads as a removal with the negative tone while unpressed", () => {
    const onClick = vi.fn();
    render(
      <ToggleChip onClick={onClick} pressed={false} tone="negative">
        Land
      </ToggleChip>,
    );
    const button = screen.getByRole("button", { name: "Land" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.classList.contains("ds-toggle-chip-negative")).toBe(true);
    expect(button.classList.contains("ds-toggle-chip-on")).toBe(false);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
