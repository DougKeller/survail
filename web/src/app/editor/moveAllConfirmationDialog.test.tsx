import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MoveAllConfirmationDialog } from "./moveAllConfirmationDialog";

afterEach(cleanup);

describe("MoveAllConfirmationDialog", () => {
  it("describes the source and counts before confirming", () => {
    const confirm = vi.fn();
    render(
      <MoveAllConfirmationDialog
        busy={false}
        onCancel={vi.fn()}
        onConfirm={confirm}
        open
        source="sideboard"
        totalQuantity={7}
        uniqueCards={4}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Move Sideboard to Considering?" }),
    ).toBeTruthy();
    expect(screen.getByText(/4 unique cards \(7 total copies\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Move all" }));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("disables dismissal and confirmation while the operation is busy", () => {
    const cancel = vi.fn();
    const confirm = vi.fn();
    render(
      <MoveAllConfirmationDialog
        busy
        onCancel={cancel}
        onConfirm={confirm}
        open
        source="mainboard"
        totalQuantity={1}
        uniqueCards={1}
      />,
    );

    expect(screen.getByRole("dialog").getAttribute("aria-busy")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Moving…" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
