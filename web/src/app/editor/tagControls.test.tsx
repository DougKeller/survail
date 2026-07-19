import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TagNameDialog } from "./tagControls";

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
