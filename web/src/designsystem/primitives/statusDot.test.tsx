import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusDot } from "./statusDot";

afterEach(cleanup);

describe("StatusDot", () => {
  it("renders a decorative pulsing accent-2 dot by default", () => {
    const { container } = render(<StatusDot />);
    const dot = container.firstElementChild;
    expect(dot?.tagName).toBe("SPAN");
    expect(dot?.className).toBe("ds-status-dot ds-status-dot-accent-2");
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
  });

  it.each([
    ["accent", "ds-status-dot-accent"],
    ["neutral", "ds-status-dot-neutral"],
  ] as const)("maps tone %s to %s", (tone, expected) => {
    const { container } = render(<StatusDot tone={tone} />);
    expect(container.firstElementChild?.classList.contains(expected)).toBe(
      true,
    );
  });

  it("turns the pulse off via the static class", () => {
    const { container } = render(<StatusDot pulse={false} />);
    expect(
      container.firstElementChild?.classList.contains("ds-status-dot-static"),
    ).toBe(true);
  });

  it("merges custom class names", () => {
    const { container } = render(<StatusDot className="extra" />);
    expect(container.firstElementChild?.classList.contains("extra")).toBe(true);
  });
});
