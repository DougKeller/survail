import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Menu, MenuItem } from "./menu";

afterEach(cleanup);

describe("Menu", () => {
  it("renders a closed trigger with menu-button wiring", () => {
    render(
      <Menu
        id="deck-menu-1"
        label="Actions for Tessa's Toolbox"
        onToggle={vi.fn()}
        open={false}
      >
        <MenuItem onSelect={vi.fn()}>Delete deck</MenuItem>
      </Menu>,
    );
    const trigger = screen.getByRole("button", {
      name: "Actions for Tessa's Toolbox",
    });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBe("deck-menu-1");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows the popover with role=menu when open and toggles on click", () => {
    const onToggle = vi.fn();
    render(
      <Menu id="deck-menu-1" label="Actions for X" onToggle={onToggle} open>
        <MenuItem onSelect={vi.fn()}>Delete deck</MenuItem>
      </Menu>,
    );
    const trigger = screen.getByRole("button", { name: "Actions for X" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu");
    expect(menu.id).toBe("deck-menu-1");
    fireEvent.click(trigger);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("fires onSelect from a danger menuitem", () => {
    const onSelect = vi.fn();
    render(
      <Menu id="m" label="Actions" onToggle={vi.fn()} open>
        <MenuItem danger onSelect={onSelect}>
          Delete deck
        </MenuItem>
      </Menu>,
    );
    const item = screen.getByRole("menuitem", { name: "Delete deck" });
    expect(item.className).toBe("ds-menu-item ds-menu-item-danger");
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("moves menu focus with arrow, Home, and End keys", () => {
    render(
      <Menu id="m" label="Actions" onToggle={vi.fn()} open>
        <MenuItem autoFocus onSelect={vi.fn()}>
          Edit
        </MenuItem>
        <MenuItem onSelect={vi.fn()}>Delete</MenuItem>
      </Menu>,
    );
    const edit = screen.getByRole("menuitem", { name: "Edit" });
    const remove = screen.getByRole("menuitem", { name: "Delete" });
    edit.focus();
    fireEvent.keyDown(edit, { key: "ArrowDown" });
    expect(document.activeElement).toBe(remove);
    fireEvent.keyDown(remove, { key: "Home" });
    expect(document.activeElement).toBe(edit);
    fireEvent.keyDown(edit, { key: "End" });
    expect(document.activeElement).toBe(remove);
  });
});
