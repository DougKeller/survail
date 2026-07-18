import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Disclosure } from "./disclosure";

afterEach(cleanup);

describe("Disclosure", () => {
  it("renders a closed details/summary with label and count", () => {
    const { container } = render(
      <Disclosure count="3/5" label="Card types">
        panel
      </Disclosure>,
    );
    const details = container.querySelector("details.ds-disclosure");
    expect(details?.hasAttribute("open")).toBe(false);
    const summary = screen.getByText("Card types").closest("summary");
    expect(summary?.className).toBe("ds-disclosure-summary");
    expect(summary?.querySelector(".ds-disclosure-count")?.textContent).toBe(
      "3/5",
    );
  });

  it("controls the open state and reports toggles", () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <Disclosure label="Roles" onOpenChange={onOpenChange} open>
        panel
      </Disclosure>,
    );
    const details = container.querySelector("details");
    expect(details?.hasAttribute("open")).toBe(true);
    expect(screen.getByText("panel").className).toBe("ds-disclosure-panel");
    if (details === null) throw new Error("missing details");
    details.open = false;
    fireEvent(details, new Event("toggle"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("applies the inline variant class", () => {
    let element: HTMLDetailsElement | null = null;
    render(
      <Disclosure
        inline
        label="Agent update"
        ref={(node) => {
          element = node;
        }}
      />,
    );
    expect(
      (element as HTMLDetailsElement | null)?.classList.contains(
        "ds-disclosure-inline",
      ),
    ).toBe(true);
  });

  it("exposes the details element through ref", () => {
    let element: HTMLDetailsElement | null = null;
    render(
      <Disclosure
        label="Zones"
        ref={(node) => {
          element = node;
        }}
      />,
    );
    expect(element).not.toBeNull();
  });
});
