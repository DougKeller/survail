import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CardSet, DeckTag } from "../../modules/decks/contracts";
import {
  TagColumnActions,
  TagNameDialog,
  TagTargetProgress,
} from "./tagControls";

afterEach(cleanup);

describe("TagNameDialog", () => {
  it("trims and submits a non-empty tag name", () => {
    const submit = vi.fn();
    render(
      <TagNameDialog
        busy={false}
        initialName=""
        onCancel={vi.fn()}
        onSubmit={submit}
        open
        title="New tag"
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Tag name" }), {
      target: { value: "  Graveyard  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));

    expect(submit).toHaveBeenCalledWith("Graveyard");
  });

  it("does not submit an empty name", () => {
    const submit = vi.fn();
    render(
      <TagNameDialog
        busy={false}
        initialName=" "
        onCancel={vi.fn()}
        onSubmit={submit}
        open
        title="Rename tag"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Save tag" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});

const tag: DeckTag = {
  id: "ramp",
  name: "Ramp",
  position: 0,
  target: 8,
};

describe("tag metadata controls", () => {
  it("keeps a blank target draft invalid instead of coercing it to zero", () => {
    const update = vi.fn().mockResolvedValue(true);
    render(
      <TagColumnActions
        busy={false}
        onDelete={vi.fn()}
        onUpdate={update}
        tag={tag}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Options for Ramp tag column" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit tag" }));
    const dialog = within(screen.getByRole("dialog", { name: "Edit tag" }));
    const target = screen.getByRole("spinbutton", {
      name: "Target contribution",
    });
    fireEvent.change(target, { target: { value: "" } });
    expect(
      dialog.getByRole("button", { name: "Save tag" }).hasAttribute("disabled"),
    ).toBe(true);

    fireEvent.change(target, { target: { value: "10.5" } });
    fireEvent.click(dialog.getByRole("button", { name: "Save tag" }));
    expect(update).toHaveBeenCalledWith(tag, "Ramp", 10.5);
  });

  it("shows a quiet no-target state without an invalid progressbar", () => {
    const card = {
      quantity: 3,
      tag_ids: ["ramp"],
      tag_weights: { ramp: 0.5 },
    } as unknown as CardSet;
    render(<TagTargetProgress cards={[card]} tag={{ ...tag, target: 0 }} />);

    expect(screen.getByText("1.5 · No target")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
