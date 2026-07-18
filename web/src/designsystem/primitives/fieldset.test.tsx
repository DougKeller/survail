import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Fieldset } from "./fieldset";

afterEach(cleanup);

describe("Fieldset", () => {
  it("renders a group named by its legend", () => {
    render(
      <Fieldset count="2/2" legend="Zones">
        <label>
          <input type="checkbox" /> Mainboard
        </label>
      </Fieldset>,
    );
    const group = screen.getByRole("group", { name: /Zones/ });
    expect(group.className).toBe("ds-fieldset");
    expect(group.querySelector(".ds-fieldset-count")?.textContent).toBe("2/2");
    expect(group.querySelector(".ds-fieldset-body")).not.toBeNull();
  });
});
