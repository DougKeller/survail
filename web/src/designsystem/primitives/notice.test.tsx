import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Notice } from "./notice";

afterEach(cleanup);

describe("Notice", () => {
  it("renders an error alert", () => {
    render(
      <Notice role="alert" tone="error">
        Request failed
      </Notice>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.classList.contains("ds-notice-error")).toBe(true);
    expect(alert.textContent).toBe("Request failed");
  });

  it("renders a sage success status", () => {
    render(
      <Notice role="status" tone="success">
        Feedback recorded
      </Notice>,
    );
    const status = screen.getByRole("status");
    expect(status.classList.contains("ds-notice-success")).toBe(true);
  });

  it("defaults to a presentational info block", () => {
    const { container } = render(<Notice>Nothing here yet.</Notice>);
    const notice = container.firstElementChild;
    expect(notice?.getAttribute("role")).toBeNull();
    expect(notice?.classList.contains("ds-notice-info")).toBe(true);
  });
});
