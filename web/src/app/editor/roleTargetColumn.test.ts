import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoleQualityPicker, roleForColumnLabel } from "./roleTargetColumn";

describe("roleForColumnLabel", () => {
  it("maps rubric headings and rejects non-role columns", () => {
    expect(roleForColumnLabel("Mana Ramp")).toBe("mana_ramp");
    expect(roleForColumnLabel("Mass Disruption")).toBe("mass_disruption");
    expect(roleForColumnLabel("Unscored")).toBeNull();
  });

  it("renders one deck-wide quality picker", () => {
    const onChange = vi.fn();
    render(
      createElement(RoleQualityPicker, {
        onChange,
        quality: "high",
      }),
    );

    const picker = screen.getByRole("combobox", {
      name: "Quality Threshold",
    });
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(
      screen.getByRole("button", {
        name: "How the quality threshold works",
      }),
    ).not.toBeNull();
    expect(screen.getByRole("tooltip").textContent).toContain(
      "how much each card counts toward a target",
    );
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Lands always count one-for-one",
    );
    fireEvent.change(picker, { target: { value: "neutral" } });
    expect(onChange).toHaveBeenCalledWith("neutral");
  });
});
