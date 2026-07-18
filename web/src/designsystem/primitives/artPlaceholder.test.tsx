import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Art } from "./artPlaceholder";

afterEach(cleanup);

describe("Art", () => {
  it("renders a washed md placeholder by default", () => {
    const { container } = render(<Art />);
    expect(container.firstElementChild?.className).toBe(
      "ds-art ds-art-md ds-art-washed",
    );
  });

  it("renders the caption label", () => {
    const { container } = render(<Art label="commander art" />);
    const label = container.querySelector(".ds-art-label");
    expect(label?.textContent).toBe("commander art");
  });

  it("supports size presets", () => {
    const { container } = render(<Art size="lg" />);
    expect(container.firstElementChild?.classList.contains("ds-art-lg")).toBe(
      true,
    );
  });

  it("stretches children with the fill class", () => {
    const { container } = render(
      <Art>
        <img alt="Sol Ring" src="sol-ring.jpg" />
      </Art>,
    );
    const art = container.firstElementChild;
    expect(art?.classList.contains("ds-art-fill")).toBe(true);
    expect(art?.querySelector("img")?.getAttribute("alt")).toBe("Sol Ring");
  });

  it("can disable the wash and round the block", () => {
    const { container } = render(<Art rounded washed={false} />);
    const art = container.firstElementChild;
    expect(art?.classList.contains("ds-art-washed")).toBe(false);
    expect(art?.classList.contains("ds-art-rounded")).toBe(true);
  });
});
