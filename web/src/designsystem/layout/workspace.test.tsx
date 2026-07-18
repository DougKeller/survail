import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Panel, PanelScroll, PaneResizer, Workspace } from "./workspace";

afterEach(cleanup);

describe("Workspace", () => {
  it("renders a main landmark and reserves panel columns when open", () => {
    render(<Workspace panelOpen>content</Workspace>);
    const main = screen.getByRole("main");
    expect(main.classList.contains("ds-workspace")).toBe(true);
    expect(main.classList.contains("ds-workspace-panel-open")).toBe(true);
  });
});

describe("PaneResizer", () => {
  it("exposes a labeled vertical separator and passes props through", () => {
    render(<PaneResizer aria-valuenow={400} label="Resize" tabIndex={0} />);
    const separator = screen.getByRole("separator", { name: "Resize" });
    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
    expect(separator.getAttribute("aria-valuenow")).toBe("400");
  });
});

describe("Panel", () => {
  it("renders a complementary landmark labeled by id", () => {
    render(
      <Panel labelledBy="panel-title">
        <h2 id="panel-title">Deck advisor</h2>
        <PanelScroll live>events</PanelScroll>
      </Panel>,
    );
    const aside = screen.getByRole("complementary", { name: "Deck advisor" });
    expect(aside.classList.contains("ds-panel")).toBe(true);
    const scroll = aside.querySelector(".ds-panel-scroll");
    expect(scroll?.getAttribute("aria-live")).toBe("polite");
  });
});
