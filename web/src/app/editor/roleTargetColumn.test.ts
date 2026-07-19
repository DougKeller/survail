import { describe, expect, it } from "vitest";

import { roleForColumnLabel } from "./roleTargetColumn";

describe("roleForColumnLabel", () => {
  it("maps rubric headings and rejects non-role columns", () => {
    expect(roleForColumnLabel("Mana Ramp")).toBe("mana_ramp");
    expect(roleForColumnLabel("Mass Disruption")).toBe("mass_disruption");
    expect(roleForColumnLabel("Unscored")).toBeNull();
  });
});
