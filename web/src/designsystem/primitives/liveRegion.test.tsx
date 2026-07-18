import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LiveRegion } from "./liveRegion";

afterEach(cleanup);

describe("LiveRegion", () => {
  it("renders a polite, atomic, visually hidden region", () => {
    const { container } = render(<LiveRegion>Working</LiveRegion>);
    const region = container.firstElementChild;
    expect(region?.className).toBe("ds-live-region");
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("aria-atomic")).toBe("true");
    expect(region?.textContent).toBe("Working");
  });
});
