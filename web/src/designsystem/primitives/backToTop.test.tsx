import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BackToTopButton } from "./backToTop";

afterEach(cleanup);

describe("BackToTopButton", () => {
  it("is hidden and unfocusable until visible", () => {
    render(<BackToTopButton onClick={vi.fn()} visible={false} />);
    const button = screen.getByText("Back to top").closest("button");
    expect(button?.getAttribute("aria-hidden")).toBe("true");
    expect(button?.tabIndex).toBe(-1);
    expect(button?.classList.contains("ds-back-to-top-visible")).toBe(false);
  });

  it("becomes an actionable labelled button once visible", () => {
    const onClick = vi.fn();
    render(
      <BackToTopButton
        icon={<svg data-testid="icon" />}
        onClick={onClick}
        visible
      />,
    );
    const button = screen.getByRole("button", { name: "Back to top" });
    expect(button.classList.contains("ds-back-to-top-visible")).toBe(true);
    expect(button.tabIndex).toBe(0);
    expect(screen.getByTestId("icon")).toBeDefined();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
