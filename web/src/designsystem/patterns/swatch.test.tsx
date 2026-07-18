import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SpaceSwatch, Swatch } from "./swatch";

afterEach(cleanup);

describe("Swatch", () => {
  it("renders a chip mapped to the token class with a default label", () => {
    const { container } = render(<Swatch token="accent-500" />);
    const chip = container.querySelector(".ds-swatch-chip");
    expect(chip?.className).toBe("ds-swatch-chip ds-swatch-accent-500");
    expect(chip?.getAttribute("aria-hidden")).toBe("true");
    const name = container.querySelector(".ds-swatch-name");
    expect(name?.textContent).toBe("--color-accent-500");
  });

  it("handles the accent-2 ramp token naming", () => {
    const { container } = render(<Swatch token="accent-2-300" />);
    const chip = container.querySelector(".ds-swatch-chip");
    expect(chip?.className).toBe("ds-swatch-chip ds-swatch-accent-2-300");
    const name = container.querySelector(".ds-swatch-name");
    expect(name?.textContent).toBe("--color-accent-2-300");
  });

  it("prefers an explicit label over the token name", () => {
    const { container } = render(<Swatch label="Warm cream" token="bg" />);
    const name = container.querySelector(".ds-swatch-name");
    expect(name?.textContent).toBe("Warm cream");
  });
});

describe("SpaceSwatch", () => {
  it("renders a bar sized by the space step with its token label", () => {
    const { container } = render(<SpaceSwatch step={6} />);
    const bar = container.querySelector(".ds-swatch-space-bar");
    expect(bar?.className).toBe("ds-swatch-space-bar ds-swatch-space-6");
    expect(bar?.getAttribute("aria-hidden")).toBe("true");
    const name = container.querySelector(".ds-swatch-name");
    expect(name?.textContent).toBe("--space-6");
  });
});
