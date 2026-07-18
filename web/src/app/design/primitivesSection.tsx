import { Leaf, Plus, Sparkles } from "lucide-react";

import { Grid } from "../../designsystem/layout/grid";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../designsystem/layout/typography";
import {
  Button,
  ButtonLink,
  IconButton,
} from "../../designsystem/primitives/button";
import { Card, CardKicker } from "../../designsystem/primitives/card";
import { Chip } from "../../designsystem/primitives/chip";
import { Notice } from "../../designsystem/primitives/notice";
import { ManaCost, ManaPip, Pip } from "../../designsystem/primitives/pip";
import { StatusDot } from "../../designsystem/primitives/statusDot";
import { Tag } from "../../designsystem/primitives/tag";

import {
  FormControlsCard,
  OverlayControlsCard,
  SelectionControlsCard,
} from "./primitiveControls";
import { TableCard, TabsCard } from "./primitiveCollections";

function ButtonsCard() {
  return (
    <Card as="article" elevation="sm">
      <Stack gap={3}>
        <CardKicker>Button and ButtonLink</CardKicker>
        <Inline gap={2} wrap>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button muted variant="ghost">
            Muted ghost
          </Button>
          <Button disabled>Disabled</Button>
        </Inline>
        <Inline gap={2} wrap>
          <Button icon={<Plus size={16} strokeWidth={2.75} />}>Add Deck</Button>
          <ButtonLink href="#design-primitives-title" variant="secondary">
            ButtonLink anchor
          </ButtonLink>
          <IconButton label="Sparkle something">
            <Sparkles size={16} strokeWidth={2.75} />
          </IconButton>
        </Inline>
      </Stack>
    </Card>
  );
}

function PillsCard() {
  return (
    <Card as="article">
      <Stack gap={3}>
        <CardKicker>Chip, Tag, Pip, StatusDot</CardKicker>
        <Inline gap={2} wrap>
          <Chip icon={<Leaf size={12} strokeWidth={2.75} />}>Ramp</Chip>
          <Chip count={99}>Mainboard</Chip>
          <Chip
            onClick={() => {
              /* interactive chip */
            }}
          >
            Considering
          </Chip>
        </Inline>
        <Inline gap={2} wrap>
          <Tag tone="accent">Commander</Tag>
          <Tag tone="accent2">Mainboard</Tag>
          <Tag tone="neutral">Maybe</Tag>
          <Tag tone="outline">Considering</Tag>
        </Inline>
        <Inline gap={2} wrap>
          <Pip tone="neutral">4</Pip>
          <Pip tone="accent">!</Pip>
          <Pip tone="accent2" size={22}>
            12
          </Pip>
          <ManaPip color="u" size={22}>
            U
          </ManaPip>
          <ManaCost cost="{2}{R}{G}{W/U}" />
        </Inline>
        <Inline gap={2} wrap>
          <Inline as="span" gap={1}>
            <StatusDot />
            <Text as="span" muted size="sm">
              saved · rev 42
            </Text>
          </Inline>
          <Inline as="span" gap={1}>
            <StatusDot pulse={false} tone="accent" />
            <Text as="span" muted size="sm">
              scoring paused
            </Text>
          </Inline>
          <Inline as="span" gap={1}>
            <StatusDot pulse={false} tone="neutral" />
            <Text as="span" muted size="sm">
              idle
            </Text>
          </Inline>
        </Inline>
      </Stack>
    </Card>
  );
}

function NoticesCard() {
  return (
    <Card as="article">
      <Stack gap={3}>
        <CardKicker>Notice tones</CardKicker>
        <Notice role="status">
          An overview will be generated when this view opens.
        </Notice>
        <Notice role="alert" tone="error">
          Could not resolve 2 cards from the decklist.
        </Notice>
      </Stack>
    </Card>
  );
}

export function PrimitivesSection() {
  return (
    <Stack as="section" gap={4} labelledBy="design-primitives-title">
      <Stack gap={1}>
        <Kicker>Components</Kicker>
        <Heading id="design-primitives-title" level={2} size="2xl">
          Primitives
        </Heading>
        <Text muted size="md">
          The pill-shaped building blocks: actions, labels, form controls, and
          in-surface navigation.
        </Text>
      </Stack>
      <Grid gap={4}>
        <ButtonsCard />
        <PillsCard />
        <NoticesCard />
        <FormControlsCard />
        <SelectionControlsCard />
        <OverlayControlsCard />
      </Grid>
      <TableCard />
      <TabsCard />
    </Stack>
  );
}
