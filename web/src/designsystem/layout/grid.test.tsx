import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Grid } from "./grid";

afterEach(cleanup);

describe("Grid", () => {
  it("defaults to auto-fill tiles with gap 4", () => {
    const { container } = render(<Grid>x</Grid>);
    const grid = container.firstElementChild;
    expect(grid?.className).toBe("ds-grid ds-grid-gap-4");
  });

  it("applies an explicit column count", () => {
    const { container } = render(
      <Grid columns={4} gap={3}>
        x
      </Grid>,
    );
    const grid = container.firstElementChild;
    expect(grid?.classList.contains("ds-grid-cols-4")).toBe(true);
    expect(grid?.classList.contains("ds-grid-gap-3")).toBe(true);
  });
});
