import { Stack } from "../../designsystem/layout/stack";
import {
  CodeBlock,
  Heading,
  Kicker,
  Mark,
  Text,
} from "../../designsystem/layout/typography";
import { Card, CardKicker } from "../../designsystem/primitives/card";

const TEXT_SIZES = ["body", "base", "md", "sm", "xs", "2xs"] as const;

export function TypographySection() {
  return (
    <Stack as="section" gap={4} labelledBy="design-typography-title">
      <Stack gap={1}>
        <Kicker>Foundations</Kicker>
        <Heading id="design-typography-title" level={2} size="2xl">
          Typography
        </Heading>
        <Text muted size="md">
          Caprasimo carries every heading; Figtree carries body copy. Sizes come
          from the --text-* ramp.
        </Text>
      </Stack>
      <Stack gap={4}>
        <Card as="article" elevation="sm">
          <Stack gap={3}>
            <CardKicker>Heading — Caprasimo</CardKicker>
            <Heading level={3} size="4xl">
              Deck the halls (4xl)
            </Heading>
            <Heading level={3} size="3xl">
              Your decks (3xl)
            </Heading>
            <Heading level={3} size="2xl">
              Purpose and overview (2xl)
            </Heading>
            <Heading level={3} size="xl">
              Mana curve (xl)
            </Heading>
            <Heading level={3} size="lg">
              Ramp package (lg)
            </Heading>
            <Heading level={3} size="md">
              Considering (md)
            </Heading>
            <Heading level={3} size="base">
              Sideboard notes (base)
            </Heading>
          </Stack>
        </Card>
        <Card as="article">
          <Stack gap={3}>
            <CardKicker>Text — Figtree</CardKicker>
            {TEXT_SIZES.map((size) => (
              <Text key={size} size={size}>
                Search your library for a basic land card ({size})
              </Text>
            ))}
            <Text muted>
              Muted text fades the ink to 68% for meta copy while keeping AA
              contrast on the surface tint.
            </Text>
            <Text pre size="md">
              {"Pre text preserves line breaks:\nDraw a card.\nDiscard a card."}
            </Text>
            <Text size="md">
              Filter hits get an inline <Mark>Mark</Mark> highlight on the
              accent wash.
            </Text>
          </Stack>
        </Card>
        <Card as="article">
          <Stack gap={3}>
            <CardKicker>Kicker and CodeBlock</CardKicker>
            <Kicker>Default kicker — section label</Kicker>
            <Kicker tone="accent">Accent kicker — goal gradient</Kicker>
            <CodeBlock>
              {"1 Sol Ring\n1 Arcane Signet\n36 cards resolved, 0 errors"}
            </CodeBlock>
          </Stack>
        </Card>
      </Stack>
    </Stack>
  );
}
