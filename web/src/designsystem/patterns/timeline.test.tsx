import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TimelineItem } from "./timeline";

afterEach(cleanup);

describe("TimelineItem", () => {
  it("renders dot, line, and content", () => {
    const { container } = render(<TimelineItem>rev 42</TimelineItem>);
    expect(container.querySelector(".ds-timeline-item-dot")).not.toBeNull();
    expect(container.querySelector(".ds-timeline-item-line")).not.toBeNull();
    expect(container.querySelector(".ds-timeline-item-body")?.textContent).toBe(
      "rev 42",
    );
  });

  it("renders a trailing action", () => {
    render(
      <TimelineItem action={<button type="button">Revert</button>}>
        rev 41
      </TimelineItem>,
    );
    expect(screen.getByRole("button", { name: "Revert" })).toBeDefined();
  });

  it("supports dimmed and tone variants", () => {
    const { container } = render(
      <TimelineItem dimmed tone="neutral">
        rev 40
      </TimelineItem>,
    );
    expect(container.querySelector(".ds-timeline-item-dimmed")).not.toBeNull();
    expect(
      container.querySelector(".ds-timeline-item-dot-neutral"),
    ).not.toBeNull();
  });
});
