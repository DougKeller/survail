import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CodeBlock, Heading, Kicker, Mark, Text } from "./typography";

afterEach(cleanup);

describe("Heading", () => {
  it("renders the semantic level", () => {
    render(<Heading level={2}>Your decks</Heading>);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.className).toBe("ds-heading");
  });

  it("applies a visual size override independent of level", () => {
    render(
      <Heading level={5} size="base">
        Ramp
      </Heading>,
    );
    const heading = screen.getByRole("heading", { level: 5 });
    expect(heading.classList.contains("ds-heading-base")).toBe(true);
  });
});

describe("Text", () => {
  it("renders a body paragraph by default", () => {
    const { container } = render(<Text>copy</Text>);
    const text = container.querySelector("p.ds-text");
    expect(text?.classList.contains("ds-text-body")).toBe(true);
  });

  it("supports muted spans on the ramp", () => {
    const { container } = render(
      <Text as="span" muted size="xs">
        7 decks
      </Text>,
    );
    const text = container.querySelector("span.ds-text");
    expect(text?.classList.contains("ds-text-xs")).toBe(true);
    expect(text?.classList.contains("ds-text-muted")).toBe(true);
  });
});

describe("Kicker", () => {
  it("renders the uppercase label with a default tone", () => {
    const { container } = render(<Kicker>Mana curve</Kicker>);
    expect(container.querySelector("p.ds-kicker")).not.toBeNull();
  });

  it("supports the accent tone as a span", () => {
    const { container } = render(
      <Kicker as="span" tone="accent">
        The plan
      </Kicker>,
    );
    const kicker = container.querySelector("span.ds-kicker");
    expect(kicker?.classList.contains("ds-kicker-accent")).toBe(true);
  });
});

describe("Text pre", () => {
  it("preserves line breaks via the pre class", () => {
    const { container } = render(<Text pre>{"a\nb"}</Text>);
    expect(
      container.querySelector("p.ds-text")?.classList.contains("ds-text-pre"),
    ).toBe(true);
  });
});

describe("Mark", () => {
  it("renders an inline mark highlight", () => {
    const { container } = render(<Mark>Sol</Mark>);
    const mark = container.querySelector("mark.ds-mark");
    expect(mark?.textContent).toBe("Sol");
  });
});

describe("CodeBlock", () => {
  it("renders a preformatted block", () => {
    const { container } = render(<CodeBlock>{"{ }"}</CodeBlock>);
    const pre = container.querySelector("pre.ds-code-block");
    expect(pre?.textContent).toBe("{ }");
  });
});
