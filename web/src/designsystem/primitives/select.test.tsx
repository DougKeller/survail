import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Select } from "./select";

afterEach(cleanup);

describe("Select", () => {
  it("renders options and reports changes", () => {
    const onChange = vi.fn();
    render(
      <Select
        aria-label="Group by"
        onChange={(event) => {
          onChange(event.target.value);
        }}
        options={[
          { label: "Type", value: "type" },
          { label: "Color", value: "color" },
        ]}
        value="type"
      />,
    );
    const select = screen.getByLabelText("Group by");
    expect(select.className).toBe("ds-select");
    fireEvent.change(select, { target: { value: "color" } });
    expect(onChange).toHaveBeenCalledWith("color");
  });
});
