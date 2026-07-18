import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StarToggle } from "./starToggle";

afterEach(cleanup);

describe("StarToggle", () => {
  it("renders an icon-only button named by its label", () => {
    render(<StarToggle label="Star Sol Ring as a core card" />);
    const button = screen.getByRole("button", {
      name: "Star Sol Ring as a core card",
    });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toBe("ds-star-toggle");
    expect(button.querySelector("svg")?.getAttribute("fill")).toBe("none");
  });

  it("fills the star when active", () => {
    render(<StarToggle active label="Unstar Sol Ring as a core card" />);
    const button = screen.getByRole("button", {
      name: "Unstar Sol Ring as a core card",
    });
    expect(button.classList.contains("ds-star-toggle-active")).toBe(true);
    expect(button.querySelector("svg")?.getAttribute("fill")).toBe(
      "currentColor",
    );
  });

  it("forwards clicks, title, and disabled state", () => {
    const onClick = vi.fn();
    render(
      <StarToggle disabled label="Star" onClick={onClick} title="Star it" />,
    );
    const button = screen.getByRole("button", { name: "Star" });
    expect(button.getAttribute("title")).toBe("Star it");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
