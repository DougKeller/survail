import type { ReactNode } from "react";
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
import { Notice } from "../../designsystem/primitives/notice";
import { Pip } from "../../designsystem/primitives/pip";
import { Grid } from "../../designsystem/layout/grid";
import { Inline } from "../../designsystem/layout/inline";
import { PageHeader } from "../../designsystem/layout/page";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../designsystem/layout/typography";

import type { DeckAnalytics } from "../../modules/decks/analytics/contracts";
import { chartRoleSwatch, COLOR_SWATCHES, TYPE_SWATCHES } from "./groupColors";
import { titleize } from "./text";

const SERIES_COLORS = {
  manaCurve: "#ff8a5b",
};
type Bucket = DeckAnalytics["mana_curve"][number];

function averageManaValue(buckets: DeckAnalytics["mana_curve"]): string {
  let weightedTotal = 0;
  let quantityTotal = 0;
  for (const bucket of buckets) {
    const value = Number(bucket.key);
    if (!Number.isFinite(value)) continue;
    weightedTotal += value * bucket.quantity;
    quantityTotal += bucket.quantity;
  }
  if (quantityTotal === 0) return "0.00";
  return (weightedTotal / quantityTotal).toFixed(2);
}

function peakManaBucket(buckets: DeckAnalytics["mana_curve"]): Bucket | null {
  if (buckets.length === 0) return null;
  return buckets.reduce((best, current) =>
    current.quantity > best.quantity ? current : best,
  );
}

function withBarColors<T extends { key: string; label: string }>(
  buckets: T[],
  palette: Record<string, string>,
  fallback: string,
): (T & { fill: string })[] {
  return buckets.map((bucket) => ({
    ...bucket,
    fill: palette[bucket.key] ?? palette[bucket.label] ?? fallback,
  }));
}

function RoundedBar(props: {
  fill?: string;
  height?: number;
  payload?: { fill?: string };
  width?: number;
  x?: number;
  y?: number;
}) {
  const { fill, height = 0, payload, width = 0, x = 0, y = 0 } = props;
  return (
    <rect
      fill={payload?.fill ?? fill ?? "#8ca1b3"}
      height={height}
      rx={2}
      ry={2}
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

export function DeckChartsView({
  analytics,
  error,
  loading,
  refresh,
}: {
  analytics: DeckAnalytics | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}) {
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

  const manaPeak = peakManaBucket(analytics.mana_curve);
  const manaCurveTotal = analytics.mana_curve.reduce(
    (total, bucket) => total + bucket.quantity,
    0,
  );
  const colorData = withBarColors(
    analytics.color_distribution,
    COLOR_SWATCHES,
    "#8ca1b3",
  );
  const typeData = withBarColors(
    analytics.type_distribution,
    TYPE_SWATCHES,
    "#3ea4ff",
  );
  const roleData = withBarColors(
    analytics.role_distribution.buckets,
    Object.fromEntries(
      analytics.role_distribution.buckets.map((bucket) => [
        bucket.key,
        chartRoleSwatch(bucket.key, bucket.label),
      ]),
    ),
    "#8f95b2",
  );

  return (
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
        <ChartCard subtitle="Distribution" title="Mana curve">
          <ResponsiveContainer height={336} width="100%">
            <BarChart data={analytics.mana_curve}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="quantity"
                fill={SERIES_COLORS.manaCurve}
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <Inline gap={2} wrap>
            <DetailChip
              label={averageManaValue(analytics.mana_curve)}
              value="Average CMC"
            />
            <DetailChip
              label={String(analytics.nonland_cards)}
              value="Nonland cards"
            />
            {manaPeak !== null && (
              <DetailChip
                label={`${manaPeak.label} mana · ${String(manaPeak.quantity)}`}
                value={`Peak slot · ${
                  manaCurveTotal === 0
                    ? "0.0"
                    : ((manaPeak.quantity / manaCurveTotal) * 100).toFixed(1)
                }%`}
              />
            )}
          </Inline>
        </ChartCard>
        <ChartCard subtitle="Distribution" title="Color pip mix">
          <ResponsiveContainer height={336} width="100%">
            <BarChart data={colorData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="key" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="quantity"
                radius={[2, 2, 0, 0]}
                shape={<RoundedBar />}
              />
            </BarChart>
          </ResponsiveContainer>
          <Inline gap={2} wrap>
            {analytics.color_distribution.map((bucket) => (
              <DetailChip
                accent={COLOR_SWATCHES[bucket.key] ?? "#8ca1b3"}
                key={bucket.key}
                label={bucket.key}
                value={`${bucket.label} · ${String(bucket.quantity)} · ${bucket.percentage.toFixed(1)}%`}
              />
            ))}
          </Inline>
        </ChartCard>
        <ChartCard subtitle="Distribution" title="Type spread">
          <ResponsiveContainer height={336} width="100%">
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                interval={0}
                angle={-18}
                textAnchor="end"
                height={56}
              />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="quantity"
                radius={[2, 2, 0, 0]}
                shape={<RoundedBar />}
              />
            </BarChart>
          </ResponsiveContainer>
          <Inline gap={2} wrap>
            {analytics.type_distribution.map((bucket) => (
              <DetailChip
                accent={TYPE_SWATCHES[bucket.key] ?? "#3ea4ff"}
                key={bucket.key}
                label={bucket.label}
                value={`${String(bucket.quantity)} · ${bucket.percentage.toFixed(1)}%`}
              />
            ))}
          </Inline>
        </ChartCard>
        <ChartCard subtitle="Distribution" title="Role spread">
          {analytics.role_distribution.message !== null && (
            <Notice role="status">{analytics.role_distribution.message}</Notice>
          )}
          <ResponsiveContainer height={336} width="100%">
            <BarChart data={roleData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                interval={0}
                angle={-18}
                textAnchor="end"
                height={60}
                tickFormatter={(value) => titleize(String(value))}
              />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="quantity"
                radius={[2, 2, 0, 0]}
                shape={<RoundedBar />}
              />
            </BarChart>
          </ResponsiveContainer>
          <Inline gap={2} wrap>
            <DetailChip
              label={String(analytics.role_distribution.evaluated_cards)}
              value="Evaluated cards"
            />
            <DetailChip
              label={String(analytics.role_distribution.unevaluated_cards)}
              value="Unevaluated cards"
            />
            {analytics.role_distribution.buckets.map((bucket) => (
              <DetailChip
                accent={chartRoleSwatch(bucket.key, bucket.label)}
                key={bucket.key}
                label={titleize(bucket.label)}
                value={`${String(bucket.quantity)} · ${bucket.percentage.toFixed(1)}%`}
              />
            ))}
          </Inline>
          {!analytics.role_distribution.complete &&
            analytics.role_distribution.missing_cards.length > 0 && (
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
            )}
        </ChartCard>
      </Grid>
    </Stack>
  );
}
