import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Tag } from "./tag";

afterEach(cleanup);

describe("Tag", () => {
  it("renders a neutral tag by default", () => {
    const { container } = render(<Tag>Commander</Tag>);
    const tag = container.firstElementChild;
    expect(tag?.tagName).toBe("SPAN");
    expect(tag?.className).toBe("ds-tag ds-tag-neutral");
    expect(tag?.textContent).toBe("Commander");
  });

  it.each([
    ["accent", "ds-tag-accent"],
    ["accent2", "ds-tag-accent-2"],
    ["outline", "ds-tag-outline"],
  ] as const)("maps tone %s to %s", (tone, expected) => {
    const { container } = render(<Tag tone={tone}>x</Tag>);
    expect(container.firstElementChild?.className).toBe(`ds-tag ${expected}`);
  });

  it("merges custom classes and forwards props", () => {
    const { container } = render(
      <Tag className="extra" title="format">
        Draft
      </Tag>,
    );
    const tag = container.firstElementChild;
    expect(tag?.className).toBe("ds-tag ds-tag-neutral extra");
    expect(tag?.getAttribute("title")).toBe("format");
  });
});
