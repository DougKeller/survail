import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ManaCost, ManaPip, Pip, parseManaCost } from "./pip";

afterEach(cleanup);

describe("Pip", () => {
  it("renders a neutral 16px pip by default", () => {
    const { container } = render(<Pip>1</Pip>);
    expect(container.firstElementChild?.className).toBe(
      "ds-pip ds-pip-neutral",
    );
  });

  it("supports the 22px size and tones", () => {
    const { container } = render(
      <Pip size={22} tone="accent2">
        W
      </Pip>,
    );
    expect(container.firstElementChild?.className).toBe(
      "ds-pip ds-pip-accent-2 ds-pip-lg",
    );
  });
});

describe("ManaPip", () => {
  it("maps color to the mana palette class", () => {
    const { container } = render(<ManaPip color="u">U</ManaPip>);
    expect(container.firstElementChild?.className).toBe("ds-pip ds-mana-u");
  });

  it("supports generic and large pips", () => {
    const { container } = render(
      <ManaPip color="generic" size={22}>
        2
      </ManaPip>,
    );
    expect(container.firstElementChild?.className).toBe(
      "ds-pip ds-mana-generic ds-pip-lg",
    );
  });
});

describe("parseManaCost", () => {
  it("parses generic, colored, and hybrid symbols", () => {
    expect(parseManaCost("{2}{R/W}{G}")).toEqual([
      { text: "2", className: "ds-mana-generic" },
      { text: "RW", className: "ds-mana-hybrid-r-w" },
      { text: "G", className: "ds-mana-g" },
    ]);
  });

  it("normalizes case, phyrexian suffixes, and snow", () => {
    expect(parseManaCost("{u/p}{s}")).toEqual([
      { text: "U", className: "ds-mana-u" },
      { text: "S", className: "ds-mana-c" },
    ]);
  });

  it("returns an empty list for text without symbols", () => {
    expect(parseManaCost("no braces")).toEqual([]);
  });
});

describe("ManaCost", () => {
  it("renders role img with an accessible mana-cost label", () => {
    render(<ManaCost cost="{1}{U}{U}" />);
    const cost = screen.getByRole("img", { name: "Mana cost {1}{U}{U}" });
    expect(cost.className).toBe("ds-mana-cost");
    const pips = cost.querySelectorAll(".ds-pip");
    expect(pips).toHaveLength(3);
    expect(pips[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(pips[1]?.className).toBe("ds-pip ds-mana-u");
  });

  it("renders nothing for null, empty, or symbol-free costs", () => {
    expect(render(<ManaCost cost={null} />).container.innerHTML).toBe("");
    expect(render(<ManaCost cost="  " />).container.innerHTML).toBe("");
    expect(render(<ManaCost cost="plain" />).container.innerHTML).toBe("");
  });
});
