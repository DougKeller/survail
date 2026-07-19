import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoleTargetControl } from "./roleTargetControl";

describe("RoleTargetControl", () => {
  it("shows the quantity-weighted average overall score for lands", () => {
    render(
      <RoleTargetControl
        averageOverallScore={68}
        contribution={11}
        onTargetChange={vi.fn()}
        roleLabel="Land"
        target={38}
      />,
    );

    expect(screen.getByText("Average overall score: 68")).not.toBeNull();
    expect(screen.getByText("11 / 38")).not.toBeNull();
  });

  it("explains when no lands have a cached score yet", () => {
    render(
      <RoleTargetControl
        averageOverallScore={null}
        contribution={8}
        onTargetChange={vi.fn()}
        roleLabel="Land"
        target={38}
      />,
    );

    expect(
      screen.getByText("Average overall score: Not scored"),
    ).not.toBeNull();
  });
});
