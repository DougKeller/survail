import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TabButton, TabNav } from "./tabs";

afterEach(cleanup);

describe("TabNav", () => {
  it("renders a labeled navigation landmark", () => {
    render(
      <TabNav label="Deck views">
        <TabButton>Cards</TabButton>
      </TabNav>,
    );
    const nav = screen.getByRole("navigation", { name: "Deck views" });
    expect(nav.classList.contains("ds-tabs")).toBe(true);
  });
});

describe("TabButton", () => {
  it("marks the active tab with aria-current and fires onClick", () => {
    const onClick = vi.fn();
    render(
      <TabNav label="Deck views">
        <TabButton current>Cards</TabButton>
        <TabButton onClick={onClick}>Scores</TabButton>
      </TabNav>,
    );
    const active = screen.getByRole("button", { name: "Cards" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.classList.contains("ds-tab-current")).toBe(true);
    const inactive = screen.getByRole("button", { name: "Scores" });
    expect(inactive.getAttribute("aria-current")).toBeNull();
    fireEvent.click(inactive);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
