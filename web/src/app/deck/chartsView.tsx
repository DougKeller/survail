import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DeckAnalytics } from "../../modules/decks/analytics/contracts";
import { MaterialIcon, titleize } from "./text";

const COLOR_SWATCHES: Record<string, string> = {
  W: "#f4ead2",
  U: "#7bc5ff",
  B: "#4e485c",
  R: "#ff7d5e",
  G: "#5ec67a",
  C: "#c7d1dd",
};

const SERIES_COLORS = {
  manaCurve: "#ff8a5b",
  roleDistribution: "#5fcf8f",
};

const TYPE_SWATCHES: Record<string, string> = {
  Creature: "#4da3ff",
  Land: "#6fc17b",
  Instant: "#ffd166",
  Sorcery: "#ff8a5b",
  Artifact: "#b8c0cc",
  Enchantment: "#d78bff",
  Planeswalker: "#ff6f91",
  Battle: "#7ee0d4",
  Other: "#8f95b2",
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
  return buckets.reduce((best, current) => (current.quantity > best.quantity ? current : best));
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

function RoundedBar(props: { fill?: string; height?: number; payload?: { fill?: string }; width?: number; x?: number; y?: number }) {
  const { fill, height = 0, payload, width = 0, x = 0, y = 0 } = props;
  return <rect fill={payload?.fill ?? fill ?? "#8ca1b3"} height={height} rx={2} ry={2} width={width} x={x} y={y} />;
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
    <section className="analytics-card">
      <header className="analytics-card-header">
        <div>
          <span className="eyebrow">{subtitle}</span>
          <h3>{title}</h3>
        </div>
      </header>
      {children}
    </section>
  );
}

function DetailChip({ accent, label, value }: { accent?: string; label: string; value: ReactNode }) {
  return (
    <div className="analytics-detail-chip">
      {accent !== undefined && <span className="analytics-color-dot" style={{ backgroundColor: accent }} />}
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
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
      <section className="charts-view">
        <p className="card-analysis-status" role="status">
          Loading deck analytics…
        </p>
      </section>
    );
  }
  if (error !== null && analytics === null) {
    return (
      <section className="charts-view">
        <p className="notice error" role="alert">
          {error}
        </p>
      </section>
    );
  }
  if (analytics === null) {
    return (
      <section className="charts-view">
        <p className="muted">No analytics are available.</p>
      </section>
    );
  }

  const manaPeak = peakManaBucket(analytics.mana_curve);
  const manaCurveTotal = analytics.mana_curve.reduce((total, bucket) => total + bucket.quantity, 0);
  const colorData = withBarColors(analytics.color_distribution, COLOR_SWATCHES, "#8ca1b3");
  const typeData = withBarColors(analytics.type_distribution, TYPE_SWATCHES, "#3ea4ff");

  return (
    <section aria-labelledby="charts-title" className="charts-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Deck analytics</span>
          <h2 id="charts-title">Charts and composition</h2>
        </div>
        <button className="secondary-button" disabled={loading} onClick={refresh}>
          <MaterialIcon name="refresh" /> Refresh analytics
        </button>
      </div>
      {error !== null && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="analytics-summary">
        <article>
          <strong>{analytics.total_cards}</strong>
          <span>Total cards</span>
        </article>
        <article>
          <strong>{analytics.unique_cards}</strong>
          <span>Unique cards</span>
        </article>
        <article>
          <strong>{analytics.nonland_cards}</strong>
          <span>Nonland cards</span>
        </article>
      </div>
      <div className="analytics-grid">
        <ChartCard subtitle="Distribution" title="Mana curve">
          <div className="analytics-chart">
            <ResponsiveContainer height={336} width="100%">
              <BarChart data={analytics.mana_curve}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="quantity" fill={SERIES_COLORS.manaCurve} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-detail-grid analytics-detail-grid-compact">
            <DetailChip label={averageManaValue(analytics.mana_curve)} value="Average CMC" />
            <DetailChip label={String(analytics.nonland_cards)} value="Nonland cards" />
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
          </div>
        </ChartCard>
        <ChartCard subtitle="Distribution" title="Color pip mix">
          <div className="analytics-chart">
            <ResponsiveContainer height={336} width="100%">
              <BarChart data={colorData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="quantity" radius={[2, 2, 0, 0]} shape={<RoundedBar />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-detail-grid">
            {analytics.color_distribution.map((bucket) => (
              <DetailChip
                accent={COLOR_SWATCHES[bucket.key] ?? "#8ca1b3"}
                key={bucket.key}
                label={bucket.key}
                value={`${bucket.label} · ${String(bucket.quantity)} · ${bucket.percentage.toFixed(1)}%`}
              />
            ))}
          </div>
        </ChartCard>
        <ChartCard subtitle="Distribution" title="Type spread">
          <div className="analytics-chart">
            <ResponsiveContainer height={336} width="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" interval={0} angle={-18} textAnchor="end" height={56} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="quantity" radius={[2, 2, 0, 0]} shape={<RoundedBar />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-detail-grid">
            {analytics.type_distribution.map((bucket) => (
              <DetailChip
                accent={TYPE_SWATCHES[bucket.key] ?? "#3ea4ff"}
                key={bucket.key}
                label={bucket.label}
                value={`${String(bucket.quantity)} · ${bucket.percentage.toFixed(1)}%`}
              />
            ))}
          </div>
        </ChartCard>
        <ChartCard subtitle="Distribution" title="Role spread">
          {analytics.role_distribution.message !== null && (
            <p className="analytics-disclaimer" role="status">
              {analytics.role_distribution.message}
            </p>
          )}
          <div className="analytics-chart">
            <ResponsiveContainer height={336} width="100%">
              <BarChart data={analytics.role_distribution.buckets}>
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
                <Bar dataKey="quantity" fill={SERIES_COLORS.roleDistribution} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-detail-grid analytics-detail-grid-compact">
            <DetailChip label={String(analytics.role_distribution.evaluated_cards)} value="Evaluated cards" />
            <DetailChip label={String(analytics.role_distribution.unevaluated_cards)} value="Unevaluated cards" />
          </div>
          {!analytics.role_distribution.complete &&
            analytics.role_distribution.missing_cards.length > 0 && (
              <div className="analytics-missing-cards">
                <strong>Missing role evaluations</strong>
                <span>
                  {analytics.role_distribution.missing_cards
                    .slice(0, 8)
                    .map((card) => card.card_name)
                    .join(", ")}
                  {analytics.role_distribution.missing_cards.length > 8 ? ", …" : ""}
                </span>
              </div>
            )}
        </ChartCard>
      </div>
    </section>
  );
}
