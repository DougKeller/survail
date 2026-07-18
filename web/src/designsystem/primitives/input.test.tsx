import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Field, Input, TextArea } from "./input";

afterEach(cleanup);

describe("Input", () => {
  it("renders a pill input and forwards controlled props", () => {
    const onChange = vi.fn();
    render(
      <Input onChange={onChange} placeholder="Deck title" value="Tessa" />,
    );
    const input = screen.getByPlaceholderText<HTMLInputElement>("Deck title");
    expect(input.className).toBe("ds-input");
    expect(input.value).toBe("Tessa");
    fireEvent.change(input, { target: { value: "Tessa's Toolbox" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("merges custom class names", () => {
    render(<Input className="extra" readOnly value="" />);
    expect(screen.getByRole("textbox").className).toBe("ds-input extra");
  });
});

describe("TextArea", () => {
  it("renders a textarea with the rounded-md class", () => {
    render(<TextArea readOnly value="1 Sol Ring" />);
    const area = screen.getByRole<HTMLTextAreaElement>("textbox");
    expect(area.tagName).toBe("TEXTAREA");
    expect(area.className).toBe("ds-textarea");
    expect(area.value).toBe("1 Sol Ring");
  });

  it("adds the mono class for import pastes and fires onChange", () => {
    const onChange = vi.fn();
    render(<TextArea mono onChange={onChange} value="" />);
    const area = screen.getByRole("textbox");
    expect(area.className).toBe("ds-textarea ds-textarea-mono");
    fireEvent.change(area, { target: { value: "1 Arcane Signet" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("Field", () => {
  it("associates the label with its control via htmlFor", () => {
    render(
      <Field htmlFor="deck-title" label="Deck title">
        <Input id="deck-title" readOnly value="" />
      </Field>,
    );
    const input = screen.getByLabelText("Deck title");
    expect(input.id).toBe("deck-title");
  });

  it("renders an optional hint", () => {
    const { container } = render(
      <Field hint="Search a legendary creature…" label="Commander">
        <Input readOnly value="" />
      </Field>,
    );
    expect(container.firstElementChild?.className).toBe("ds-field");
    expect(container.querySelector(".ds-field-hint")?.textContent).toBe(
      "Search a legendary creature…",
    );
  });
});
