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

type Bucket = DeckAnalytics["mana_curve"][number];

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

const TAG_SWATCHES = [
  "#d78bff",
  "#7ee0d4",
  "#ffd166",
  "#ff8a5b",
  "#4da3ff",
  "#6fc17b",
  "#ff6f91",
];

function tagSwatch(key: string): string {
  if (key === "untagged") return "#8f95b2";
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return TAG_SWATCHES[hash % TAG_SWATCHES.length] ?? "#8f95b2";
}

function DistributionChart({
  after,
  before,
  buckets,
  colorFor,
  displayLabel = (bucket) => bucket.label,
  title,
}: {
  after?: ReactNode;
  before?: ReactNode;
  buckets: Bucket[];
  colorFor: (bucket: Bucket) => string;
  displayLabel?: (bucket: Bucket) => string;
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
            radius={[2, 2, 0, 0]}
            shape={<RoundedBar />}
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
  error,
  loading,
  refresh,
  scoringEnabled,
}: {
  analytics: DeckAnalytics | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
  scoringEnabled: boolean;
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
        <DistributionChart
          buckets={analytics.type_distribution}
          colorFor={(bucket) => TYPE_SWATCHES[bucket.key] ?? "#3ea4ff"}
          title="Type"
        />
        <DistributionChart
          buckets={analytics.color_distribution}
          colorFor={(bucket) => COLOR_SWATCHES[bucket.key] ?? "#8ca1b3"}
          title="Color"
        />
        <DistributionChart
          buckets={analytics.mana_curve}
          colorFor={() => "#ff8a5b"}
          displayLabel={(bucket) => `Mana value ${bucket.label}`}
          title="Mana value"
        />
        <DistributionChart
          buckets={analytics.tag_distribution}
          colorFor={(bucket) => tagSwatch(bucket.key)}
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
            title="Role"
          />
        )}
      </Grid>
    </Stack>
  );
}
