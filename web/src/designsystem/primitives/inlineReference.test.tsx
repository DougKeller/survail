import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InlineReferenceTrigger, InlineText } from "./inlineReference";

afterEach(cleanup);

describe("InlineReferenceTrigger", () => {
  it("renders a button carrying both the ds class and the e2e hook class", () => {
    const onClick = vi.fn();
    render(
      <InlineReferenceTrigger onClick={onClick}>
        Lightning Bolt
      </InlineReferenceTrigger>,
    );
    const trigger = screen.getByRole("button", { name: "Lightning Bolt" });
    expect(trigger.classList.contains("ds-inline-reference-trigger")).toBe(
      true,
    );
    expect(trigger.classList.contains("inline-card-reference-trigger")).toBe(
      true,
    );
    fireEvent.click(trigger);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards hover handlers and aria attributes", () => {
    const onMouseEnter = vi.fn();
    render(
      <InlineReferenceTrigger
        aria-haspopup="dialog"
        onMouseEnter={onMouseEnter}
      >
        Sol Ring
      </InlineReferenceTrigger>,
    );
    const trigger = screen.getByRole("button", { name: "Sol Ring" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    fireEvent.mouseEnter(trigger);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });
});

describe("InlineText", () => {
  it("wraps children in the break-preserving span", () => {
    render(<InlineText>line one</InlineText>);
    expect(
      screen.getByText("line one").classList.contains("ds-inline-text"),
    ).toBe(true);
  });
});
