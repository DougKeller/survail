import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "./dialog";

afterEach(cleanup);

function renderDialog(onClose = vi.fn(), open = true) {
  const view = render(
    <Dialog
      actions={<button type="button">Re-validate</button>}
      onClose={onClose}
      open={open}
      title="Validation"
    >
      <button type="button">Back to editor</button>
    </Dialog>,
  );
  return { onClose, view };
}

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    const { view } = renderDialog(vi.fn(), false);
    expect(view.container.innerHTML).toBe("");
  });

  it("renders a modal dialog labelled by its title", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Validation" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.className).toBe("ds-dialog");
    expect(screen.getByText("Re-validate").parentElement?.className).toBe(
      "ds-dialog-actions",
    );
  });

  it("moves focus into the dialog and closes on Escape", async () => {
    const { onClose } = renderDialog();
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Back to editor");
    });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop pointerdown but not on inside pointerdown", () => {
    const { onClose, view } = renderDialog();
    fireEvent.pointerDown(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    const backdrop = view.container.querySelector(".ds-dialog-backdrop");
    expect(backdrop).not.toBeNull();
    if (backdrop !== null) fireEvent.pointerDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab focus within the dialog", async () => {
    renderDialog();
    const first = screen.getByText("Back to editor");
    const last = screen.getByText("Re-validate");
    await waitFor(() => {
      expect(document.activeElement).toBe(first);
    });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("wires the description, busy state, wide size, and close button", () => {
    const onClose = vi.fn();
    render(
      <Dialog
        busy
        closeLabel="Close card details"
        description="Choose a printing."
        onClose={onClose}
        open
        size="wide"
        title="Printings"
      />,
    );
    const dialog = screen.getByRole("dialog", {
      name: "Printings",
      description: "Choose a printing.",
    });
    expect(dialog.classList.contains("ds-dialog-wide")).toBe(true);
    expect(dialog.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Close card details" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks body scroll while open and restores it on unmount", () => {
    const { view } = renderDialog();
    expect(document.body.style.overflow).toBe("hidden");
    view.unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
