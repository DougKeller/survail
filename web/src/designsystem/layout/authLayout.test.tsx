import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthLayout } from "./authLayout";

afterEach(cleanup);

describe("AuthLayout", () => {
  it("renders a main landmark with a centered panel body", () => {
    render(<AuthLayout>Sign in</AuthLayout>);
    const main = screen.getByRole("main");
    expect(main.classList.contains("ds-auth-layout")).toBe(true);
    expect(main.querySelector(".ds-auth-panel-body")?.textContent).toBe(
      "Sign in",
    );
  });

  it("renders the footer strip only when provided", () => {
    const { container, rerender } = render(<AuthLayout>x</AuthLayout>);
    expect(container.querySelector(".ds-auth-panel-footer")).toBeNull();
    rerender(<AuthLayout footer={<span>art</span>}>x</AuthLayout>);
    expect(container.querySelector(".ds-auth-panel-footer")?.textContent).toBe(
      "art",
    );
  });
});
