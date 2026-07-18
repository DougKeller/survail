import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../designsystem/layout/typography";
import { Card, CardKicker } from "../../designsystem/primitives/card";
import {
  SpaceSwatch,
  Swatch,
  type SpaceStep,
  type SwatchToken,
} from "../../designsystem/patterns/swatch";

const RAMP_STEPS = [
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
] as const;

const BASE_TOKENS: { label: string; token: SwatchToken }[] = [
  { label: "bg — warm cream ground", token: "bg" },
  { label: "surface — panel tint", token: "surface" },
  { label: "text — body ink", token: "text" },
  { label: "accent — terracotta", token: "accent" },
  { label: "accent-2 — sage", token: "accent-2" },
  { label: "divider — hairline", token: "divider" },
];

const SPACE_STEPS: SpaceStep[] = [1, 2, 3, 4, 6, 8];

function Ramp({
  kicker,
  prefix,
}: {
  kicker: string;
  prefix: "accent" | "accent-2" | "neutral";
}) {
  return (
    <Stack gap={2}>
      <CardKicker>{kicker}</CardKicker>
      <Inline gap={2} wrap>
        {RAMP_STEPS.map((step) => (
          <Swatch key={step} token={`${prefix}-${step}`} />
        ))}
      </Inline>
    </Stack>
  );
}

export function TokensSection() {
  return (
    <Stack as="section" gap={4} labelledBy="design-tokens-title">
      <Stack gap={1}>
        <Kicker>Foundations</Kicker>
        <Heading id="design-tokens-title" level={2} size="2xl">
          Tokens
        </Heading>
        <Text muted size="md">
          Every color and spacing value in the system comes from
          designsystem/tokens.css. These are the core surfaces and the three
          tonal ramps.
        </Text>
      </Stack>
      <Card as="article" elevation="sm">
        <Stack gap={4}>
          <Stack gap={2}>
            <CardKicker>Core surfaces and brand colors</CardKicker>
            <Inline gap={2} wrap>
              {BASE_TOKENS.map(({ label, token }) => (
                <Swatch key={token} label={label} token={token} />
              ))}
            </Inline>
          </Stack>
          <Ramp kicker="Terracotta ramp — accent 100 to 900" prefix="accent" />
          <Ramp kicker="Sage ramp — accent-2 100 to 900" prefix="accent-2" />
          <Ramp kicker="Neutral ramp — 100 to 900" prefix="neutral" />
        </Stack>
      </Card>
      <Card as="article">
        <Stack gap={2}>
          <CardKicker>Spacing — the 1.10x density scale</CardKicker>
          <Inline align="end" gap={4} wrap>
            {SPACE_STEPS.map((step) => (
              <SpaceSwatch key={step} step={step} />
            ))}
          </Inline>
          <Text muted size="sm">
            Layout components (Stack, Inline, Grid) take these steps as gap
            props, so app code never writes raw pixel values.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
