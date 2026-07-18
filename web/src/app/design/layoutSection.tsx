import {
  Board,
  BoardColumn,
  BoardLayout,
} from "../../designsystem/layout/board";
import { Divided, SplitPane } from "../../designsystem/layout/divided";
import { Grid } from "../../designsystem/layout/grid";
import { FlexSpacer, Inline } from "../../designsystem/layout/inline";
import { Rail } from "../../designsystem/layout/rail";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Kicker, Text } from "../../designsystem/layout/typography";
import { Card, CardKicker } from "../../designsystem/primitives/card";
import { Chip } from "../../designsystem/primitives/chip";
import { Tag } from "../../designsystem/primitives/tag";
import { CardRow } from "../../designsystem/patterns/cardRow";
import { ColumnHeader } from "../../designsystem/patterns/columnHeader";
import { MeterPanel } from "../../designsystem/patterns/statPanel";

function LabeledRow({ label, value }: { label: string; value: string }) {
  return (
    <Inline gap={4} justify="between">
      <Text as="span" muted size="md">
        {label}
      </Text>
      <Text as="span" size="md">
        {value}
      </Text>
    </Inline>
  );
}

function FlowCard() {
  return (
    <Card as="article" elevation="sm">
      <Stack gap={3}>
        <CardKicker>Stack, Inline, FlexSpacer</CardKicker>
        <Stack gap={2}>
          <Chip>Stack child one</Chip>
          <Chip>Stack child two</Chip>
          <Chip>Stack child three</Chip>
        </Stack>
        <Inline gap={2}>
          <Tag tone="accent">Leading</Tag>
          <Tag tone="neutral">Middle</Tag>
          <FlexSpacer />
          <Tag tone="accent2">Pushed to the end</Tag>
        </Inline>
      </Stack>
    </Card>
  );
}

function GridDividedCard() {
  return (
    <Card as="article">
      <Stack gap={3}>
        <CardKicker>Grid and Divided</CardKicker>
        <Grid columns={3} gap={3}>
          <Card elevation="sm">
            <Text size="sm">Tile A</Text>
          </Card>
          <Card elevation="sm">
            <Text size="sm">Tile B</Text>
          </Card>
          <Card elevation="sm">
            <Text size="sm">Tile C</Text>
          </Card>
        </Grid>
        <Divided>
          <LabeledRow label="Format" value="Commander" />
          <LabeledRow label="Cards" value="99" />
          <LabeledRow label="Status" value="Valid" />
        </Divided>
      </Stack>
    </Card>
  );
}

function SplitCard() {
  return (
    <Card as="article">
      <Stack gap={3}>
        <CardKicker>SplitPane</CardKicker>
        <SplitPane tint="end">
          <Stack gap={1}>
            <Kicker>Start fresh</Kicker>
            <Text muted size="md">
              Leading pane content.
            </Text>
          </Stack>
          <Stack gap={1}>
            <Kicker>Import</Kicker>
            <Text muted size="md">
              Trailing pane on the surface tint.
            </Text>
          </Stack>
        </SplitPane>
      </Stack>
    </Card>
  );
}

function BoardRailCard() {
  return (
    <Card as="article" padded={false}>
      <BoardLayout>
        <Board>
          <BoardColumn>
            <ColumnHeader count={2} level={3} title="Ramp" />
            <CardRow name="Sol Ring" qty={1} />
            <CardRow name="Cultivate" qty={1} />
          </BoardColumn>
          <BoardColumn width="narrow">
            <ColumnHeader count={1} level={3} title="Commander" />
            <CardRow name="Tessa, Toolbox Titan" qty={1} />
          </BoardColumn>
        </Board>
        <Rail as="section" label="Deck details demo">
          <Stack gap={2}>
            <Kicker>Rail</Kicker>
            <MeterPanel label="Deck completion" max={99} value={58} />
          </Stack>
        </Rail>
      </BoardLayout>
    </Card>
  );
}

export function LayoutSection() {
  return (
    <Stack as="section" gap={4} labelledBy="design-layout-title">
      <Stack gap={1}>
        <Kicker>Structure</Kicker>
        <Heading id="design-layout-title" level={2} size="2xl">
          Layout
        </Heading>
        <Text muted size="md">
          Flow, grid, split, and the editor Board with its right Rail — all gaps
          come from the spacing scale.
        </Text>
      </Stack>
      <Grid gap={4}>
        <FlowCard />
        <GridDividedCard />
        <SplitCard />
      </Grid>
      <BoardRailCard />
    </Stack>
  );
}
