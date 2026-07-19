import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClearScoreCacheDialog } from "./clearScoreCacheDialog";

afterEach(cleanup);

describe("ClearScoreCacheDialog", () => {
  it("requires explicit confirmation and explains the scope", () => {
    const confirm = vi.fn();
    render(
      <ClearScoreCacheDialog
        clearing={false}
        onCancel={vi.fn()}
        onConfirm={confirm}
        open
      />,
    );

    expect(
      screen.getByRole("dialog", { name: /clear all cached scores/i }),
    ).toBeTruthy();
    expect(screen.getByText(/does not change the decklist/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear cache" }));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("prevents actions while clearing", () => {
    render(
      <ClearScoreCacheDialog
        clearing
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
      />,
    );
    expect(
      screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Clearing…" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
