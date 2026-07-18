import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SortableHeader, Table, TableScroll } from "./table";

afterEach(cleanup);

describe("Table", () => {
  it("renders a table with the shell class and children", () => {
    render(
      <Table className="extra">
        <thead>
          <tr>
            <th>Card</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Sol Ring</td>
          </tr>
        </tbody>
      </Table>,
    );
    const table = screen.getByRole("table");
    expect(table.className).toBe("ds-table extra");
    expect(screen.getByRole("columnheader").textContent).toBe("Card");
    expect(screen.getByRole("cell").textContent).toBe("Sol Ring");
  });

  it("wraps wide tables in a horizontal scroll shell", () => {
    const { container } = render(
      <TableScroll>
        <Table>
          <tbody />
        </Table>
      </TableScroll>,
    );
    expect(container.firstElementChild?.className).toBe("ds-table-scroll");
    expect(container.querySelector(".ds-table-scroll > .ds-table")).not.toBe(
      null,
    );
  });
});

describe("SortableHeader", () => {
  it("renders a type=button sort toggle without an arrow when inactive", () => {
    render(<SortableHeader>Score</SortableHeader>);
    const button = screen.getByRole("button", { name: "Score" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toBe("ds-table-sort");
    expect(button.querySelector(".ds-table-sort-arrow")).toBeNull();
  });

  it("shows the direction arrow when active", () => {
    render(
      <SortableHeader active direction="desc">
        Score
      </SortableHeader>,
    );
    const button = screen.getByRole("button", { name: /Score/ });
    expect(button.className).toBe("ds-table-sort ds-table-sort-active");
    const arrow = button.querySelector(".ds-table-sort-arrow");
    expect(arrow?.textContent).toBe("▼");
    expect(arrow?.getAttribute("aria-hidden")).toBe("true");
  });

  it("fires onClick", () => {
    const onClick = vi.fn();
    render(<SortableHeader onClick={onClick}>Cost</SortableHeader>);
    fireEvent.click(screen.getByRole("button", { name: "Cost" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
