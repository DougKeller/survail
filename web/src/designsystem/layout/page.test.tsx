import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Page, PageHeader } from "./page";

afterEach(cleanup);

describe("Page", () => {
  it("renders a main landmark with the page class", () => {
    render(<Page>content</Page>);
    const main = screen.getByRole("main");
    expect(main.classList.contains("ds-page")).toBe(true);
    expect(main.textContent).toBe("content");
  });

  it("reflects busy work via aria-busy", () => {
    render(<Page busy>content</Page>);
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
  });

  it("supports alternate elements", () => {
    const { container } = render(<Page as="section">inner</Page>);
    expect(container.querySelector("section.ds-page")).not.toBeNull();
  });
});

describe("PageHeader", () => {
  it("renders lead content inside a banner", () => {
    render(<PageHeader>Your decks</PageHeader>);
    const header = screen.getByRole("banner");
    expect(header.classList.contains("ds-page-header")).toBe(true);
    expect(header.textContent).toBe("Your decks");
  });

  it("renders trailing actions only when provided", () => {
    const { container, rerender } = render(<PageHeader>t</PageHeader>);
    expect(container.querySelector(".ds-page-header-actions")).toBeNull();
    rerender(
      <PageHeader actions={<button type="button">New</button>}>t</PageHeader>,
    );
    expect(
      container.querySelector(".ds-page-header-actions button"),
    ).not.toBeNull();
  });
});
