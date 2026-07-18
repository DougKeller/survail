import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NavBar, NavBrand, NavLink } from "./nav";

afterEach(cleanup);

describe("NavBar", () => {
  it("renders a nav landmark", () => {
    render(
      <NavBar aria-label="Primary">
        <NavBrand>Survail</NavBrand>
      </NavBar>,
    );
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.className).toBe("ds-nav");
  });

  it("adds the divider class when divided", () => {
    render(<NavBar divided />);
    expect(screen.getByRole("navigation").className).toBe(
      "ds-nav ds-nav-divided",
    );
  });
});

describe("NavBrand", () => {
  it("renders the wordmark span", () => {
    render(<NavBrand>Survail</NavBrand>);
    const brand = screen.getByText("Survail");
    expect(brand.tagName).toBe("SPAN");
    expect(brand.className).toBe("ds-nav-brand");
  });
});

describe("NavLink", () => {
  it("renders a plain link without aria-current by default", () => {
    render(<NavLink href="/cards">Cards</NavLink>);
    const link = screen.getByRole("link", { name: "Cards" });
    expect(link.getAttribute("href")).toBe("/cards");
    expect(link.className).toBe("ds-nav-link");
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("marks the current page with aria-current", () => {
    render(
      <NavLink current href="/decks">
        Decks
      </NavLink>,
    );
    expect(
      screen.getByRole("link", { name: "Decks" }).getAttribute("aria-current"),
    ).toBe("page");
  });
});
