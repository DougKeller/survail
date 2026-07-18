import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddRow } from "./addRow";

afterEach(cleanup);

describe("AddRow", () => {
  it("renders a dashed pill button and fires onClick", () => {
    const onClick = vi.fn();
    render(<AddRow onClick={onClick}>add to Ramp</AddRow>);
    const button = screen.getByRole("button", { name: "add to Ramp" });
    expect(button.className).toBe("ds-add-row");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies the ghost column variant", () => {
    render(<AddRow variant="ghost">New category</AddRow>);
    const button = screen.getByRole("button", { name: "New category" });
    expect(button.classList.contains("ds-add-row-ghost")).toBe(true);
  });
});
