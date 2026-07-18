import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button, ButtonLink, IconButton } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("renders a primary pill button of type button by default", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toBe("ds-btn ds-btn-primary");
  });

  it("applies variant, block, and custom classes", () => {
    render(
      <Button block className="extra" variant="ghost">
        Cancel
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button.className).toBe("ds-btn ds-btn-ghost ds-btn-block extra");
  });

  it("respects an explicit type prop", () => {
    render(<Button type="submit">Go</Button>);
    expect(
      screen.getByRole("button", { name: "Go" }).getAttribute("type"),
    ).toBe("submit");
  });

  it("renders a leading icon in an aria-hidden slot", () => {
    render(<Button icon={<svg data-testid="icon" />}>New deck</Button>);
    const slot = screen.getByTestId("icon").parentElement;
    expect(slot?.className).toBe("ds-btn-leading");
    expect(slot?.getAttribute("aria-hidden")).toBe("true");
  });

  it("fires onClick and honors disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nope" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("ButtonLink", () => {
  it("renders an anchor with pill button classes and an href", () => {
    render(
      <ButtonLink block href="/auth/discord/login">
        Continue with Discord
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Continue with Discord" });
    expect(link.getAttribute("href")).toBe("/auth/discord/login");
    expect(link.className).toBe("ds-btn ds-btn-primary ds-btn-block");
  });

  it("supports variants and a leading icon slot", () => {
    render(
      <ButtonLink href="#cancel" icon={<svg data-testid="i" />} variant="ghost">
        Cancel
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Cancel" });
    expect(link.className).toBe("ds-btn ds-btn-ghost");
    const slot = screen.getByTestId("i").parentElement;
    expect(slot?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("IconButton", () => {
  it("renders an icon-only secondary button with an aria-label", () => {
    render(
      <IconButton label="History">
        <svg data-testid="history-icon" />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "History" });
    expect(button.className).toBe("ds-btn ds-btn-secondary ds-btn-icon");
    expect(screen.getByTestId("history-icon")).toBeDefined();
  });

  it("supports variant overrides and clicks", () => {
    const onClick = vi.fn();
    render(
      <IconButton label="Describe" onClick={onClick} variant="primary">
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Describe" });
    expect(button.className).toContain("ds-btn-primary");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
