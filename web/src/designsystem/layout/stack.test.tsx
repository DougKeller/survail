import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Stack } from "./stack";

afterEach(cleanup);

describe("Stack", () => {
  it("renders a div with default gap and alignment classes", () => {
    const { container } = render(<Stack>x</Stack>);
    const stack = container.firstElementChild;
    expect(stack?.tagName).toBe("DIV");
    expect(stack?.className).toBe(
      "ds-stack ds-stack-gap-3 ds-stack-align-stretch",
    );
  });

  it("maps gap and align props to classes", () => {
    const { container } = render(
      <Stack align="center" gap={6}>
        x
      </Stack>,
    );
    const stack = container.firstElementChild;
    expect(stack?.classList.contains("ds-stack-gap-6")).toBe(true);
    expect(stack?.classList.contains("ds-stack-align-center")).toBe(true);
  });

  it("supports list semantics via as", () => {
    const { container } = render(<Stack as="ul">x</Stack>);
    expect(container.querySelector("ul.ds-stack")).not.toBeNull();
  });

  it("names a section region via labelledBy", () => {
    const { container } = render(
      <Stack as="section" labelledBy="scores-title">
        x
      </Stack>,
    );
    expect(
      container
        .querySelector("section.ds-stack")
        ?.getAttribute("aria-labelledby"),
    ).toBe("scores-title");
  });
});
