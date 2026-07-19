import { Grid } from "../../designsystem/layout/grid";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../designsystem/layout/typography";
import { Button } from "../../designsystem/primitives/button";
import { Card, CardKicker } from "../../designsystem/primitives/card";
import { Art } from "../../designsystem/primitives/artPlaceholder";
import { ManaCost } from "../../designsystem/primitives/pip";
import { AddRow } from "../../designsystem/patterns/addRow";
import { CardRow } from "../../designsystem/patterns/cardRow";
import { ColumnHeader } from "../../designsystem/patterns/columnHeader";
import { CurveBars } from "../../designsystem/patterns/curve";
import { GhostTile } from "../../designsystem/patterns/emptyTile";
import { ColorIdentityRow } from "../../designsystem/patterns/identity";
import {
  GroupTile,
  ImageTile,
  ImageTileActions,
  ImageTileBadge,
} from "../../designsystem/patterns/imageTile";
import { MeterPanel } from "../../designsystem/patterns/statPanel";
import { TimelineItem } from "../../designsystem/patterns/timeline";
import { ValidationItem } from "../../designsystem/patterns/validationItem";

function CardRowsCard() {
  return (
    <Card as="article" elevation="sm">
      <Stack gap={3}>
        <CardKicker>ColumnHeader and CardRow</CardKicker>
        <ColumnHeader count={4} level={3} title="Ramp" />
        <Stack gap={1}>
          <CardRow name="Sol Ring" qty={1}>
            <ManaCost cost="{1}" />
          </CardRow>
          <CardRow grip name="Cultivate" qty={1}>
            <ManaCost cost="{2}{G}" />
          </CardRow>
          <CardRow emphasis interactive name="Three Visits" qty={1}>
            <ManaCost cost="{1}{G}" />
          </CardRow>
          <CardRow name="Smothering Tithe" qty={1} tone="accent" />
          <CardRow name="Nature's Lore" qty={1} tone="accent-2">
            <ManaCost cost="{1}{G}" />
          </CardRow>
        </Stack>
        <AddRow>add to Ramp</AddRow>
        <ColumnHeader count={0} level={3} title="New category" tone="accent" />
        <AddRow variant="ghost">New category</AddRow>
      </Stack>
    </Card>
  );
}

function StatsCard() {
  return (
    <Card as="article">
      <Stack gap={3}>
        <CardKicker>MeterPanel, CurveBars, ColorIdentityRow</CardKicker>
        <MeterPanel label="Deck completion" max={75} tone="accent" value={58} />
        <MeterPanel label="Lands" max={38} value={38} valueText="38 / 38" />
        <Stack gap={1}>
          <Kicker>Mana curve</Kicker>
          <CurveBars
            labels={["0", "1", "2", "3", "4", "5", "6", "7+"]}
            values={[2, 8, 14, 18, 11, 6, 3, 2]}
          />
        </Stack>
        <Stack gap={1}>
          <Kicker>Color identity</Kicker>
          <ColorIdentityRow colors={["W", "U", "B", "R", "G"]} />
        </Stack>
      </Stack>
    </Card>
  );
}

function ValidationTimelineCard() {
  return (
    <Card as="article">
      <Stack gap={3}>
        <CardKicker>ValidationItem and Timeline</CardKicker>
        <Stack gap={1}>
          <ValidationItem detail="99 / 99" label="Card count" status="ok" />
          <ValidationItem
            detail="singleton ok"
            label="Copy limits"
            status="ok"
          />
          <ValidationItem
            detail="2 cards"
            label="Outside color identity"
            status="warn"
          />
        </Stack>
        <Stack gap={0}>
          <TimelineItem
            action={
              <Button muted variant="ghost">
                Revert
              </Button>
            }
          >
            <Text size="md">Added 2x Lightning Bolt</Text>
            <Text muted size="sm">
              rev 42 · a minute ago
            </Text>
          </TimelineItem>
          <TimelineItem dimmed tone="neutral">
            <Text size="md">Removed Chaos Warp</Text>
            <Text muted size="sm">
              rev 41 · reverted
            </Text>
          </TimelineItem>
          <TimelineItem tone="accent">
            <Text size="md">Imported from Moxfield</Text>
            <Text muted size="sm">
              rev 1 · origin
            </Text>
          </TimelineItem>
        </Stack>
      </Stack>
    </Card>
  );
}

function TilesCard() {
  return (
    <Card as="article">
      <Stack gap={3}>
        <CardKicker>ImageTile, GroupTile, GhostTile</CardKicker>
        <Grid columns={3} gap={3}>
          <ImageTile>
            <ImageTileActions />
            <ImageTileBadge>2x</ImageTileBadge>
            <ImageTileBadge corner="bottom-right" tone="accent">
              9
            </ImageTileBadge>
            <Art label="card art" rounded size="lg" />
          </ImageTile>
          <GroupTile count="12 cards" eyebrow="Card type" title="Instant" />
          <GhostTile label="New deck" />
        </Grid>
        <Text muted size="sm">
          Hover or focus the image tile to reveal its action cluster.
        </Text>
      </Stack>
    </Card>
  );
}

export function PatternsSection() {
  return (
    <Stack as="section" gap={4} labelledBy="design-patterns-title">
      <Stack gap={1}>
        <Kicker>Components</Kicker>
        <Heading id="design-patterns-title" level={2} size="2xl">
          Patterns
        </Heading>
        <Text muted size="md">
          Deck-editor compositions built from the primitives: rows, stats,
          history, and tiles.
        </Text>
      </Stack>
      <Grid gap={4}>
        <CardRowsCard />
        <StatsCard />
        <ValidationTimelineCard />
        <TilesCard />
      </Grid>
    </Stack>
  );
}
