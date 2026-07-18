import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tab, TabList } from "./tablist";

afterEach(cleanup);

describe("TabList", () => {
  it("renders a named tablist of tabs with selection state", () => {
    const onClick = vi.fn();
    render(
      <TabList label="Card details tabs">
        <Tab selected>Analysis</Tab>
        <Tab onClick={onClick}>Info</Tab>
      </TabList>,
    );
    expect(screen.getByRole("tablist", { name: "Card details tabs" })).not.toBe(
      null,
    );
    const analysis = screen.getByRole("tab", { name: "Analysis" });
    expect(analysis.getAttribute("aria-selected")).toBe("true");
    expect(analysis.classList.contains("ds-tablist-tab-selected")).toBe(true);
    const info = screen.getByRole("tab", { name: "Info" });
    expect(info.getAttribute("aria-selected")).toBe("false");
    fireEvent.click(info);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
