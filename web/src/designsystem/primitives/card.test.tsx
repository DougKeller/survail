import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  Card,
  CardBody,
  CardContent,
  CardKicker,
  CardMeta,
  CardTitle,
} from "./card";

afterEach(cleanup);

describe("Card", () => {
  it("renders a padded div card by default", () => {
    const { container } = render(<Card>content</Card>);
    const card = container.firstElementChild;
    expect(card?.tagName).toBe("DIV");
    expect(card?.className).toBe("ds-card ds-card-padded");
  });

  it("applies elevation and disables padding", () => {
    const { container } = render(
      <Card elevation="sm" padded={false}>
        x
      </Card>,
    );
    expect(container.firstElementChild?.className).toBe("ds-card ds-elev-sm");
  });

  it("renders the dashed ghost tile as an anchor", () => {
    const { container } = render(
      <Card as="a" dashed href="#new">
        New deck
      </Card>,
    );
    const card = container.firstElementChild;
    expect(card?.tagName).toBe("A");
    expect(card?.getAttribute("href")).toBe("#new");
    expect(card?.className).toBe("ds-card ds-card-padded ds-card-dashed");
  });

  it("supports article semantics", () => {
    const { container } = render(<Card as="article">x</Card>);
    expect(container.querySelector("article.ds-card")).not.toBeNull();
  });

  it("attaches a ref to the rendered element", () => {
    const ref = { current: null as HTMLElement | null };
    const { container } = render(
      <Card as="article" ref={ref}>
        x
      </Card>,
    );
    expect(ref.current).toBe(container.querySelector("article.ds-card"));
  });
});

describe("Card slots", () => {
  it("renders title, kicker, body, and meta with their classes", () => {
    const { container } = render(
      <Card>
        <CardKicker>Deck completion</CardKicker>
        <CardTitle>{"Tessa's Toolbox"}</CardTitle>
        <CardBody>An artifact-heavy midrange deck.</CardBody>
        <CardMeta>Ready to play · 99/99</CardMeta>
      </Card>,
    );
    expect(container.querySelector(".ds-card-kicker")?.textContent).toBe(
      "Deck completion",
    );
    expect(container.querySelector(".ds-card-title")?.textContent).toBe(
      "Tessa's Toolbox",
    );
    expect(container.querySelector(".ds-card-body")).not.toBeNull();
    expect(container.querySelector(".ds-card-meta")?.textContent).toBe(
      "Ready to play · 99/99",
    );
  });

  it("merges custom classes on slots", () => {
    const { container } = render(<CardTitle className="extra">t</CardTitle>);
    expect(container.firstElementChild?.className).toBe("ds-card-title extra");
  });

  it("renders the title as a link when href is given", () => {
    const { container } = render(
      <CardTitle href="/decks/42">{"Tessa's Toolbox"}</CardTitle>,
    );
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/decks/42");
    expect(link?.className).toBe("ds-card-title ds-card-title-link");
  });

  it("renders a padded content region", () => {
    const { container } = render(<CardContent>body</CardContent>);
    expect(container.firstElementChild?.className).toBe("ds-card-content");
  });
});
