import type { ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DeckAnalytics } from "../../modules/decks/analytics/contracts";
import type { CardSet } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import { cardsForAnalyticsBucket, DeckChartsView } from "./chartsView";

vi.mock("recharts", async () => {
  const React = await import("react");
  function Container({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  function BarChart({
    children,
    data,
  }: {
    children?: ReactNode;
    data: Record<string, unknown>[];
  }) {
    return (
      <div>
        {React.Children.map(children, (child) =>
          React.isValidElement<Record<string, unknown>>(child)
            ? React.cloneElement(child, { chartData: data })
            : child,
        )}
      </div>
    );
  }
  function MockBar({
    chartData = [],
    shape,
  }: {
    chartData?: Record<string, unknown>[];
    shape?: React.ReactElement<Record<string, unknown>>;
  }) {
    if (shape === undefined) return null;
    return chartData.map((payload, index) =>
      React.cloneElement(shape, {
        height: 20,
        key:
          typeof payload["key"] === "string" ? payload["key"] : String(index),
        payload,
        width: 20,
      }),
    );
  }
  return {
    Bar: MockBar,
    BarChart,
    CartesianGrid: Container,
    ResponsiveContainer: Container,
    Tooltip: Container,
    XAxis: Container,
    YAxis: Container,
  };
});

const bucket = (key: string, label: string, quantity = 1) => ({
  key,
  label,
  percentage: 100,
  quantity,
});

const analytics: DeckAnalytics = {
  total_cards: 3,
  unique_cards: 2,
  nonland_cards: 3,
  mana_curve: [bucket("2", "2", 3)],
  color_distribution: [bucket("U", "Blue", 3)],
  type_distribution: [bucket("Creature", "Creature", 3)],
  tag_distribution: [bucket("tag-id", "Engine", 2)],
  role_distribution: {
    available: true,
    buckets: [bucket("payoff", "payoff", 2)],
    complete: true,
    evaluated_cards: 2,
    message: null,
    missing_cards: [],
    total_cards: 2,
    unevaluated_cards: 0,
  },
};

function card(
  id: string,
  name: string,
  overrides: Partial<CardSet> = {},
): CardSet {
  return {
    card_name: name,
    collector_number: "1",
    finish: "nonfoil",
    id,
    note: "",
    oracle_id: `oracle-${id}`,
    printing_id: `printing-${id}`,
    quantity: 1,
    scryfall: {
      card_faces: [],
      collector_number: "1",
      finishes: ["nonfoil"],
      id: `printing-${id}`,
      image_uris: { normal: null },
      lang: "en",
      layout: "normal",
      legalities: {},
      mana_cost: "{1}{U}",
      name,
      oracle_id: `oracle-${id}`,
      oracle_text: "",
      rarity: "common",
      set: "tst",
      set_name: "Test",
      type_line: "Creature",
    },
    set_code: "tst",
    tag_ids: ["tag-id"],
    tag_weights: { "tag-id": 0.25 },
    tags: ["Engine"],
    zone: "mainboard",
    ...overrides,
  } as CardSet;
}

const engineCard = card("engine", "Engine Card", {
  quantity: 2,
  scryfall: {
    ...card("base", "Base").scryfall,
    cmc: 2,
    id: "printing-engine",
    name: "Engine Card",
    oracle_id: "oracle-engine",
  },
});
const sideboardCard = card("sideboard", "Sideboard Card", {
  zone: "sideboard",
});
const scores = new Map<string, CardRoleEvaluation>([
  [
    engineCard.oracle_id,
    {
      cached: true,
      deck_revision: 1,
      evaluator_version: "test",
      oracle_id: engineCard.oracle_id,
      overall_comment: "",
      overall_score: 80,
      prompt_version: "test",
      roles: [{ answers: {}, description: "", role: "payoff", score: 80 }],
    },
  ],
]);

afterEach(cleanup);

describe("DeckChartsView", () => {
  it("uses the same distribution template for every dimension", () => {
    render(
      <DeckChartsView
        analytics={analytics}
        cards={[engineCard, sideboardCard]}
        error={null}
        loading={false}
        refresh={vi.fn()}
        scores={scores}
        scoringEnabled
      />,
    );

    for (const title of [
      "Type spread",
      "Color spread",
      "Mana value spread",
      "Tag spread",
      "Role spread",
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    expect(screen.getByText("Engine")).toBeTruthy();
  });

  it("omits the role aggregation when scoring is disabled", () => {
    render(
      <DeckChartsView
        analytics={analytics}
        cards={[engineCard]}
        error={null}
        loading={false}
        refresh={vi.fn()}
        scores={scores}
        scoringEnabled={false}
      />,
    );

    expect(screen.queryByText("Role spread")).toBeNull();
    expect(screen.getByText("Tag spread")).toBeTruthy();
  });

  it("opens a card-list dialog from mouse and keyboard bar activation", () => {
    render(
      <DeckChartsView
        analytics={analytics}
        cards={[engineCard, sideboardCard]}
        error={null}
        loading={false}
        refresh={vi.fn()}
        scores={scores}
        scoringEnabled
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Show cards for Engine" }),
    );
    const tagDialog = screen.getByRole("dialog", { name: "Engine tag cards" });
    expect(
      within(tagDialog).getAllByText("Engine Card").length,
    ).toBeGreaterThan(0);
    expect(within(tagDialog).queryByText("Sideboard Card")).toBeNull();
    fireEvent.click(
      within(tagDialog).getByRole("button", { name: "Close card list" }),
    );

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Show cards for Mana value 2" }),
      { key: "Enter" },
    );
    expect(
      screen.getByRole("dialog", { name: "Mana value 2 mana value cards" }),
    ).toBeTruthy();
  });

  it("matches exact chart semantics, ignoring tag weights", () => {
    const dimensions = [
      ["Type", analytics.type_distribution[0]],
      ["Color", analytics.color_distribution[0]],
      ["Mana value", analytics.mana_curve[0]],
      ["Tag", analytics.tag_distribution[0]],
      ["Role", analytics.role_distribution.buckets[0]],
    ] as const;

    for (const [dimension, targetBucket] of dimensions) {
      expect(
        cardsForAnalyticsBucket(
          dimension,
          targetBucket ?? bucket("missing", "Missing"),
          [engineCard, sideboardCard],
          scores,
        ).map((entry) => entry.card_name),
      ).toEqual(["Engine Card"]);
    }
  });
});
