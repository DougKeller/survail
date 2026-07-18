import "./rangeBand.css";

interface RangeBandProps {
  /** Upper bound of the allowed band, in score units. */
  high: number;
  /** Accessible name, e.g. "Mana Ramp score". */
  label: string;
  /** Lower bound of the allowed band, in score units. */
  low: number;
  /** Scale maximum (scores run 0..max). */
  max?: number;
  /** Marker coloring: pass = sage, fail = terracotta. */
  tone?: "fail" | "pass";
  /** Actual score marker; omit to render the allowed band alone. */
  value?: number;
}

const MARKER_WIDTH = 2;

/** Clamped 0..100 position on the band's viewBox scale. */
function bandPosition(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(Math.max(value / max, 0), 1) * 100;
}

/** Allowed-range meter: a neutral track with the allowed [low, high] band
    and an optional marker for the actual score (judge reference views). */
export function RangeBand({
  high,
  label,
  low,
  max = 100,
  tone = "pass",
  value,
}: RangeBandProps) {
  const bandStart = bandPosition(low, max);
  const bandWidth = Math.max(bandPosition(high, max) - bandStart, 0);
  const marker =
    value === undefined
      ? null
      : Math.min(
          Math.max(bandPosition(value, max) - MARKER_WIDTH / 2, 0),
          100 - MARKER_WIDTH,
        );
  const reading = `allowed ${String(low)} to ${String(high)}`;
  const description =
    value === undefined
      ? `${label}: ${reading}`
      : `${label}: scored ${String(value)}, ${reading}`;
  const classes = ["ds-range-band", tone === "fail" ? "ds-range-band-fail" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <svg
      aria-label={description}
      className={classes}
      preserveAspectRatio="none"
      role="img"
      viewBox="0 0 100 12"
    >
      <rect
        className="ds-range-band-track"
        height="4"
        rx="2"
        width="100"
        x="0"
        y="4"
      />
      <rect
        className="ds-range-band-allowed"
        height="4"
        rx="2"
        width={bandWidth}
        x={bandStart}
        y="4"
      />
      {marker !== null && (
        <rect
          className="ds-range-band-marker"
          height="12"
          rx="1"
          width={MARKER_WIDTH}
          x={marker}
          y="0"
        />
      )}
    </svg>
  );
}
