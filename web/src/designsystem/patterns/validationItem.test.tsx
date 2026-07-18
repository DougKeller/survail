import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ValidationItem } from "./validationItem";

afterEach(cleanup);

describe("ValidationItem", () => {
  it("renders an ok row with detail and a screen-reader status", () => {
    const { container } = render(
      <ValidationItem detail="99 / 99" label="Deck size" status="ok" />,
    );
    const row = container.querySelector(".ds-validation-item");
    expect(row?.classList.contains("ds-validation-item-ok")).toBe(true);
    expect(
      container.querySelector(".ds-validation-item-detail")?.textContent,
    ).toBe("99 / 99");
    expect(screen.getByText("Passed:").className).toBe("sr-only");
  });

  it("renders a warn row with the exclamation pip", () => {
    const { container } = render(
      <ValidationItem label="Legality — Sol Ring is banned" status="warn" />,
    );
    const row = container.querySelector(".ds-validation-item");
    expect(row?.classList.contains("ds-validation-item-warn")).toBe(true);
    expect(
      container.querySelector(".ds-validation-item-pip")?.textContent,
    ).toBe("!");
    expect(screen.getByText("Warning:").className).toBe("sr-only");
  });

  it("exposes live-region semantics via the role prop", () => {
    render(
      <ValidationItem label="Request failed" role="alert" status="warn" />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Request failed");
  });
});
