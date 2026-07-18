import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Checkbox, Radio, Segmented, SegmentedButtons } from "./choice";

afterEach(cleanup);

describe("Radio", () => {
  it("renders a labelled radio input with the dot element", () => {
    const { container } = render(
      <Radio checked={false} label="Commander" name="fmt" onChange={vi.fn()} />,
    );
    const radio = screen.getByRole<HTMLInputElement>("radio", {
      name: "Commander",
    });
    expect(radio.checked).toBe(false);
    expect(container.querySelector(".ds-choice-dot")).not.toBeNull();
  });

  it("fires onChange when clicked", () => {
    const onChange = vi.fn();
    render(<Radio checked={false} label="Modern" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Modern" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("Checkbox", () => {
  it("renders a controlled checkbox", () => {
    const onChange = vi.fn();
    render(<Checkbox checked label="Preserve tags" onChange={onChange} />);
    const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Preserve tags",
    });
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("Segmented", () => {
  const options = [
    { label: "All", value: "all" },
    { label: "Commander", value: "commander" },
    { label: "Modern", value: "modern" },
  ];

  it("renders one named radio per option with the current value checked", () => {
    render(
      <Segmented
        name="ff"
        onChange={vi.fn()}
        options={options}
        value="commander"
      />,
    );
    const radios = screen.getAllByRole<HTMLInputElement>("radio");
    expect(radios).toHaveLength(3);
    expect(radios.every((radio) => radio.name === "ff")).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "Commander" })
        .checked,
    ).toBe(true);
  });

  it("reports the picked value through onChange", () => {
    const onChange = vi.fn();
    render(
      <Segmented name="ff" onChange={onChange} options={options} value="all" />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Modern" }));
    expect(onChange).toHaveBeenCalledWith("modern");
  });

  it("uses the seg classes for :has(:checked) styling", () => {
    const { container } = render(
      <Segmented name="ff" onChange={vi.fn()} options={options} value="all" />,
    );
    expect(container.firstElementChild?.className).toBe("ds-seg");
    expect(container.querySelectorAll("label.ds-seg-opt")).toHaveLength(3);
    expect(container.querySelectorAll("input.ds-seg-input")).toHaveLength(3);
  });

  it("names the group when a label is given", () => {
    render(
      <Segmented
        label="Add to"
        name="zone"
        onChange={vi.fn()}
        options={options}
        value="all"
      />,
    );
    expect(screen.getByRole("group", { name: "Add to" })).not.toBeNull();
  });
});

describe("SegmentedButtons", () => {
  const options = [
    { label: "Stacks", value: "stacks" },
    { label: "Grid", value: "grid" },
    { label: "Text", value: "text" },
  ];

  it("renders pressed-state buttons and reports changes", () => {
    const onChange = vi.fn();
    render(
      <SegmentedButtons
        label="Card view"
        onChange={onChange}
        options={options}
        value="stacks"
      />,
    );
    const pressed = screen.getByRole("button", { name: "Stacks" });
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
    expect(pressed.classList.contains("ds-seg-opt-on")).toBe(true);
    const text = screen.getByRole("button", { name: "Text" });
    expect(text.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(text);
    expect(onChange).toHaveBeenCalledWith("text");
  });
});
