import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Divided, SplitPane } from "./divided";

afterEach(cleanup);

describe("Divided", () => {
  it("wraps rows in the divided container", () => {
    const { container } = render(
      <Divided>
        <div>row one</div>
        <div>row two</div>
      </Divided>,
    );
    const divided = container.querySelector(".ds-divided");
    expect(divided?.childElementCount).toBe(2);
  });
});

describe("SplitPane", () => {
  it("renders an even split by default", () => {
    const { container } = render(
      <SplitPane>
        <div>fresh</div>
        <div>import</div>
      </SplitPane>,
    );
    expect(container.firstElementChild?.className).toBe("ds-split-pane");
  });

  it("supports the wide-end ratio with an end tint", () => {
    const { container } = render(
      <SplitPane ratio="wide-end" tint="end">
        <div>fresh</div>
        <div>import</div>
      </SplitPane>,
    );
    const pane = container.firstElementChild;
    expect(pane?.classList.contains("ds-split-pane-wide-end")).toBe(true);
    expect(pane?.classList.contains("ds-split-pane-tint-end")).toBe(true);
  });
});
