import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Board, BoardColumn, BoardLayout } from "./board";

afterEach(cleanup);

describe("BoardLayout", () => {
  it("renders the board + rail pairing region", () => {
    const { container } = render(<BoardLayout>board</BoardLayout>);
    expect(container.querySelector(".ds-board-layout")?.textContent).toBe(
      "board",
    );
  });
});

describe("Board", () => {
  it("renders a scrolling row container", () => {
    const { container } = render(<Board>cols</Board>);
    expect(container.querySelector(".ds-board")?.textContent).toBe("cols");
  });
});

describe("BoardColumn", () => {
  it("renders a section at the default width", () => {
    const { container } = render(<BoardColumn>rows</BoardColumn>);
    const column = container.querySelector("section.ds-board-column");
    expect(column?.className).toBe("ds-board-column");
  });

  it("applies narrow and ghost width variants", () => {
    const { container } = render(
      <>
        <BoardColumn width="narrow">a</BoardColumn>
        <BoardColumn width="ghost">b</BoardColumn>
      </>,
    );
    expect(container.querySelector(".ds-board-column-narrow")).not.toBeNull();
    expect(container.querySelector(".ds-board-column-ghost")).not.toBeNull();
  });
});
