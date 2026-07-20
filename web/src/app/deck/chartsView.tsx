/* eslint-disable max-lines -- Shared chart templates and their drill-down semantics stay synchronized here. */
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "../../designsystem/primitives/button";
import {
  Card,
  CardKicker,
  CardTitle,
} from "../../designsystem/primitives/card";
import { Chip } from "../../designsystem/primitives/chip";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Notice } from "../../designsystem/primitives/notice";
import { Pip } from "../../designsystem/primitives/pip";
import { Grid } from "../../designsystem/layout/grid";
import { Inline } from "../../designsystem/layout/inline";
import { PageHeader } from "../../designsystem/layout/page";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../designsystem/layout/typography";
import { CardRow } from "../../designsystem/patterns/cardRow";

import { ClickableCardImage } from "../../modules/cards/ui/cardPresentation";
import type { DeckAnalytics } from "../../modules/decks/analytics/contracts";
import type { CardSet, DeckTag } from "../../modules/decks/contracts";
import type { CardRoleEvaluation } from "../../modules/decks/evaluations/contracts";
import {
  chartRoleSwatch,
  COLOR_SWATCHES,
  tagSwatches,
  TYPE_SWATCHES,
} from "./groupColors";
import { titleize, zoneLabel } from "./text";

type Bucket = DeckAnalytics["mana_curve"][number];
type Dimension = "Color" | "Mana value" | "Role" | "Tag" | "Type";
type ChartBucket = Bucket & { chartLabel: string; fill: string };

const ANALYTICS_ZONES = new Set(["commander", "mainboard"]);
const CARD_TYPES = [
  "Creature",
  "Land",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Battle",
];

function typeLines(card: CardSet): string[] {
  const faces = card.scryfall.card_faces as readonly {
    type_line?: string | undefined;
  }[];
  if (faces.length > 0)
    return faces.flatMap((face) =>
      face.type_line === undefined ? [] : [face.type_line],
    );
  return [card.scryfall.type_line];
}

function isLand(card: CardSet): boolean {
  return typeLines(card).some((line) => line.includes("Land"));
}

function manaCosts(card: CardSet): string[] {
  if (card.scryfall.mana_cost) return [card.scryfall.mana_cost];
  const faces = card.scryfall.card_faces as readonly {
    mana_cost?: string | null | undefined;
  }[];
  return faces.flatMap((face) => (face.mana_cost ? [face.mana_cost] : []));
}

function hasManaPip(card: CardSet, color: string): boolean {
  for (const cost of manaCosts(card)) {
    for (const match of cost.matchAll(/\{([^}]+)\}/g)) {
      if ((match[1] ?? "").toUpperCase().includes(color)) return true;
    }
  }
  return false;
}

export function cardsForAnalyticsBucket(
  dimension: Dimension,
  bucket: Bucket,
  cards: readonly CardSet[],
  scores: ReadonlyMap<string, CardRoleEvaluation>,
): CardSet[] {
  return cards
    .filter((card) => ANALYTICS_ZONES.has(card.zone))
    .filter((card) => {
      if (dimension === "Type") {
        const matches = CARD_TYPES.filter((type) =>
          typeLines(card).some((line) => line.includes(type)),
        );
        return bucket.key === "Other"
          ? matches.length === 0
          : matches.includes(bucket.key);
      }
      if (dimension === "Color")
        return !isLand(card) && hasManaPip(card, bucket.key);
      if (dimension === "Mana value")
        return !isLand(card) && String(card.scryfall.cmc ?? 0) === bucket.key;
      if (dimension === "Tag") {
        if (bucket.key === "untagged")
          return (
            card.tag_ids?.length === 0 ||
            (card.tag_ids === undefined && card.tags.length === 0)
          );
        return card.tag_ids === undefined
          ? card.tags.includes(bucket.label)
          : card.tag_ids.includes(bucket.key);
      }
      return (
        scores
          .get(card.oracle_id)
          ?.roles.some((role) => role.role === bucket.key) === true
      );
    })
    .sort((left, right) => left.card_name.localeCompare(right.card_name));
}

function InteractiveBar(props: {
  fill?: string;
  height?: number;
  onActivate: (bucket: Bucket) => void;
  payload?: ChartBucket;
  width?: number;
  x?: number;
  y?: number;
}) {
  const {
    fill,
    height = 0,
    onActivate,
    payload,
    width = 0,
    x = 0,
    y = 0,
  } = props;
  const activate = () => {
    if (payload !== undefined) onActivate(payload);
  };
  const handleKeyDown = (event: KeyboardEvent<SVGRectElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activate();
  };
  return (
    <rect
      aria-label={
        payload === undefined
          ? undefined
          : `Show cards for ${payload.chartLabel}`
      }
      fill={payload?.fill ?? fill ?? "#8ca1b3"}
      height={height}
      onClick={activate}
      onKeyDown={handleKeyDown}
      role="button"
      rx={2}
      ry={2}
      cursor="pointer"
      tabIndex={0}
      width={width}
      x={x}
      y={y}
    />
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Card as="article" elevation="sm">
      <Stack gap={3}>
        <Stack gap={1}>
          <CardKicker>{subtitle}</CardKicker>
          <CardTitle>{title}</CardTitle>
        </Stack>
        {children}
      </Stack>
    </Card>
  );
}

function DetailChip({
  accent,
  label,
  value,
}: {
  accent?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <Chip
      count={value}
      icon={
        accent === undefined ? undefined : (
          <Pip style={{ backgroundColor: accent }} />
        )
      }
    >
      {label}
    </Chip>
  );
}

export function completeManaCurve(buckets: readonly Bucket[]): Bucket[] {
  const numericBuckets = buckets
    .map((bucket) => ({ bucket, value: Number(bucket.key) }))
    .filter((entry) => Number.isFinite(entry.value));
  if (numericBuckets.length === 0) return [...buckets];
  const byValue = new Map(
    numericBuckets.map((entry) => [entry.value, entry.bucket]),
  );
  const minimum = Math.min(...numericBuckets.map((entry) => entry.value));
  const maximum = Math.max(...numericBuckets.map((entry) => entry.value));
  for (let value = Math.ceil(minimum); value <= Math.floor(maximum); value += 1)
    if (!byValue.has(value))
      byValue.set(value, {
        key: String(value),
        label: String(value),
        percentage: 0,
        quantity: 0,
      });
  return [...byValue.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, bucket]) => bucket);
}

function channel(hex: string, offset: number): number {
  return Number.parseInt(hex.slice(offset, offset + 2), 16);
}

function gradientColor(start: string, end: string, ratio: number): string {
  const component = (offset: number) =>
    Math.round(
      channel(start, offset) +
        (channel(end, offset) - channel(start, offset)) * ratio,
    )
      .toString(16)
      .padStart(2, "0");
  return `#${component(1)}${component(3)}${component(5)}`;
}

export function manaValueSwatches(
  buckets: readonly Bucket[],
): ReadonlyMap<string, string> {
  const values = buckets.map((bucket) => Number(bucket.key));
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum;
  return new Map(
    buckets.map((bucket) => {
      const value = Number(bucket.key);
      const ratio = span === 0 ? 0.5 : (value - minimum) / span;
      return [bucket.key, gradientColor("#4da3ff", "#ff6f91", ratio)];
    }),
  );
}

function DistributionChart({
  after,
  before,
  buckets,
  colorFor,
  displayLabel = (bucket) => bucket.label,
  onSelect,
  title,
}: {
  after?: ReactNode;
  before?: ReactNode;
  buckets: Bucket[];
  colorFor: (bucket: Bucket) => string;
  displayLabel?: (bucket: Bucket) => string;
  onSelect: (bucket: Bucket, label: string) => void;
  title: string;
}) {
  const data = buckets.map((bucket) => ({
    ...bucket,
    chartLabel: displayLabel(bucket),
    fill: colorFor(bucket),
  }));
  return (
    <ChartCard subtitle="Distribution" title={`${title} spread`}>
      {before}
      <ResponsiveContainer height={336} width="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            angle={-18}
            dataKey="chartLabel"
            height={60}
            interval={0}
            textAnchor="end"
          />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar
            dataKey="quantity"
            minPointSize={2}
            radius={[2, 2, 0, 0]}
            shape={
              <InteractiveBar
                onActivate={(bucket) => {
                  onSelect(bucket, displayLabel(bucket));
                }}
              />
            }
          />
        </BarChart>
      </ResponsiveContainer>
      <Inline gap={2} wrap>
        {buckets.map((bucket) => (
          <DetailChip
            accent={colorFor(bucket)}
            key={bucket.key}
            label={displayLabel(bucket)}
            value={`${String(bucket.quantity)} · ${bucket.percentage.toFixed(1)}%`}
          />
        ))}
      </Inline>
      {after}
    </ChartCard>
  );
}

export function DeckChartsView({
  analytics,
  cards,
  error,
  loading,
  refresh,
  scores,
  scoringEnabled,
  tags,
}: {
  analytics: DeckAnalytics | null;
  cards: readonly CardSet[];
  error: string | null;
  loading: boolean;
  refresh: () => void;
  scores: ReadonlyMap<string, CardRoleEvaluation>;
  scoringEnabled: boolean;
  tags: readonly DeckTag[];
}) {
  const [selection, setSelection] = useState<{
    cards: CardSet[];
    dimension: Dimension;
    label: string;
  } | null>(null);
  if (loading && analytics === null) {
    return (
      <Stack as="section" gap={6}>
        <Notice role="status">Loading deck analytics…</Notice>
      </Stack>
    );
  }
  if (error !== null && analytics === null) {
    return (
      <Stack as="section" gap={6}>
        <Notice role="alert" tone="error">
          {error}
        </Notice>
      </Stack>
    );
  }
  if (analytics === null) {
    return (
      <Stack as="section" gap={6}>
        <Text muted>No analytics are available.</Text>
      </Stack>
    );
  }

  const selectBucket =
    (dimension: Dimension) => (bucket: Bucket, label: string) => {
      setSelection({
        cards: cardsForAnalyticsBucket(dimension, bucket, cards, scores),
        dimension,
        label,
      });
    };
  const manaCurve = completeManaCurve(analytics.mana_curve);
  const manaColors = manaValueSwatches(manaCurve);
  const tagColors = tagSwatches([
    ...tags.map((tag) => tag.id),
    ...analytics.tag_distribution.map((bucket) => bucket.key),
  ]);
  const closeSelection = (): void => {
    const triggerLabel =
      selection === null ? null : `Show cards for ${selection.label}`;
    setSelection(null);
    if (triggerLabel !== null)
      requestAnimationFrame(() => {
        const trigger = [
          ...document.querySelectorAll<HTMLElement>(
            '[role="button"][aria-label]',
          ),
        ].find((element) => element.getAttribute("aria-label") === triggerLabel);
        trigger?.focus();
      });
  };

  return (
    <>
      <Stack as="section" gap={6} labelledBy="charts-title">
        <PageHeader
          actions={
            <Button
              disabled={loading}
              icon={<RefreshCw size={15} strokeWidth={2.75} />}
              onClick={refresh}
              variant="secondary"
            >
              Refresh analytics
            </Button>
          }
        >
          <Stack gap={1}>
            <Kicker>Deck analytics</Kicker>
            <Heading id="charts-title" level={2} size="2xl">
              Charts and composition
            </Heading>
          </Stack>
        </PageHeader>
        {error !== null && (
          <Notice role="alert" tone="error">
            {error}
          </Notice>
        )}
        <Grid columns={3} gap={3}>
          <Card>
            <CardKicker>Total cards</CardKicker>
            <CardTitle>{analytics.total_cards}</CardTitle>
          </Card>
          <Card>
            <CardKicker>Unique cards</CardKicker>
            <CardTitle>{analytics.unique_cards}</CardTitle>
          </Card>
          <Card>
            <CardKicker>Nonland cards</CardKicker>
            <CardTitle>{analytics.nonland_cards}</CardTitle>
          </Card>
        </Grid>
        <Grid columns={2} gap={4}>
          <DistributionChart
            buckets={analytics.type_distribution}
            colorFor={(bucket) => TYPE_SWATCHES[bucket.key] ?? "#3ea4ff"}
            onSelect={selectBucket("Type")}
            title="Type"
          />
          <DistributionChart
            buckets={analytics.color_distribution}
            colorFor={(bucket) => COLOR_SWATCHES[bucket.key] ?? "#8ca1b3"}
            onSelect={selectBucket("Color")}
            title="Color"
          />
          <DistributionChart
            buckets={manaCurve}
            colorFor={(bucket) => manaColors.get(bucket.key) ?? "#8ca1b3"}
            displayLabel={(bucket) => `Mana value ${bucket.label}`}
            onSelect={selectBucket("Mana value")}
            title="Mana value"
          />
          <DistributionChart
            buckets={analytics.tag_distribution}
            colorFor={(bucket) => tagColors.get(bucket.key) ?? "#8f95b2"}
            onSelect={selectBucket("Tag")}
            title="Tag"
          />
          {scoringEnabled && (
            <DistributionChart
              after={
                !analytics.role_distribution.complete &&
                analytics.role_distribution.missing_cards.length > 0 ? (
                  <Stack gap={1}>
                    <Kicker>Missing role evaluations</Kicker>
                    <Text muted size="md">
                      {analytics.role_distribution.missing_cards
                        .slice(0, 8)
                        .map((card) => card.card_name)
                        .join(", ")}
                      {analytics.role_distribution.missing_cards.length > 8
                        ? ", …"
                        : ""}
                    </Text>
                  </Stack>
                ) : undefined
              }
              before={
                analytics.role_distribution.message === null ? undefined : (
                  <Notice role="status">
                    {analytics.role_distribution.message}
                  </Notice>
                )
              }
              buckets={analytics.role_distribution.buckets}
              colorFor={(bucket) => chartRoleSwatch(bucket.key, bucket.label)}
              displayLabel={(bucket) => titleize(bucket.label)}
              onSelect={selectBucket("Role")}
              title="Role"
            />
          )}
        </Grid>
      </Stack>
      <Dialog
        closeLabel="Close card list"
        description={
          selection === null
            ? undefined
            : `${String(selection.cards.length)} card entries · ${String(
                selection.cards.reduce(
                  (total, card) => total + card.quantity,
                  0,
                ),
              )} cards`
        }
        onClose={closeSelection}
        open={selection !== null}
        size="wide"
        title={
          selection === null
            ? "Cards"
            : `${selection.label} ${selection.dimension.toLocaleLowerCase()} cards`
        }
      >
        {selection !== null && (
          <Stack gap={2}>
            {selection.cards.length === 0 ? (
              <Text muted>No cards match this bucket.</Text>
            ) : (
              selection.cards.map((card) => (
                <CardRow
                  dense
                  key={card.id}
                  leading={<ClickableCardImage card={card} size="thumb" />}
                  name={card.card_name}
                  qty={card.quantity}
                >
                  <Text as="span" muted size="sm">
                    {zoneLabel(card.zone)}
                  </Text>
                </CardRow>
              ))
            )}
          </Stack>
        )}
      </Dialog>
    </>
  );
}
