import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DeckAnalytics } from "../../modules/decks/analytics/contracts";
import { DeckChartsView } from "./chartsView";

vi.mock("recharts", () => {
  function Container({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  return {
    Bar: Container,
    BarChart: Container,
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

afterEach(cleanup);

describe("DeckChartsView", () => {
  it("uses the same distribution template for every dimension", () => {
    render(
      <DeckChartsView
        analytics={analytics}
        error={null}
        loading={false}
        refresh={vi.fn()}
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
        error={null}
        loading={false}
        refresh={vi.fn()}
        scoringEnabled={false}
      />,
    );

    expect(screen.queryByText("Role spread")).toBeNull();
    expect(screen.getByText("Tag spread")).toBeTruthy();
  });
});
