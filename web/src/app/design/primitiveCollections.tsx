import { useState } from "react";

import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { Card, CardKicker } from "../../designsystem/primitives/card";
import { ManaCost } from "../../designsystem/primitives/pip";
import {
  SortableHeader,
  Table,
  TableScroll,
} from "../../designsystem/primitives/table";
import { Tab, TabList } from "../../designsystem/primitives/tablist";
import { TabButton, TabNav } from "../../designsystem/primitives/tabs";
import { Tag } from "../../designsystem/primitives/tag";

const SCORE_ROWS = [
  { cost: "{1}", name: "Sol Ring", ramp: 10, removal: 0, zone: "Mainboard" },
  {
    cost: "{2}",
    name: "Arcane Signet",
    ramp: 9,
    removal: 0,
    zone: "Mainboard",
  },
  {
    cost: "{1}{W}",
    name: "Swords to Plowshares",
    ramp: 0,
    removal: 10,
    zone: "Mainboard",
  },
  {
    cost: "{2}{G}",
    name: "Beast Within",
    ramp: 0,
    removal: 8,
    zone: "Considering",
  },
];

export function TableCard() {
  const [descending, setDescending] = useState(true);
  const rows = [...SCORE_ROWS].sort((a, b) =>
    descending ? b.ramp - a.ramp : a.ramp - b.ramp,
  );
  return (
    <Card as="article">
      <Stack gap={3}>
        <CardKicker>Table with SortableHeader</CardKicker>
        <TableScroll>
          <Table>
            <thead>
              <tr>
                <th>Card</th>
                <th>Cost</th>
                <th>Zone</th>
                <th>
                  <SortableHeader
                    active
                    direction={descending ? "desc" : "asc"}
                    onClick={() => {
                      setDescending((current) => !current);
                    }}
                  >
                    Ramp
                  </SortableHeader>
                </th>
                <th>
                  <SortableHeader>Removal</SortableHeader>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>
                    <ManaCost cost={row.cost} />
                  </td>
                  <td>
                    <Tag
                      tone={row.zone === "Mainboard" ? "accent2" : "outline"}
                    >
                      {row.zone}
                    </Tag>
                  </td>
                  <td>{row.ramp}</td>
                  <td>{row.removal}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      </Stack>
    </Card>
  );
}

const VIEW_COPY: Record<string, string> = {
  cards: "The board of category columns, one CardRow per card.",
  charts: "Mana curve, color balance, and role coverage charts.",
  scores: "The role-score table with per-column sorting.",
};

export function TabsCard() {
  const [view, setView] = useState("cards");
  const [detail, setDetail] = useState("analysis");
  return (
    <Card as="article">
      <Stack gap={3}>
        <CardKicker>Tabs (view switcher) and TabList (in-surface)</CardKicker>
        <TabNav label="Deck views">
          {[
            { label: "Cards", value: "cards" },
            { label: "Scores", value: "scores" },
            { label: "Charts", value: "charts" },
          ].map((entry) => (
            <TabButton
              current={view === entry.value}
              key={entry.value}
              onClick={() => {
                setView(entry.value);
              }}
            >
              {entry.label}
            </TabButton>
          ))}
        </TabNav>
        <Text muted size="md">
          {VIEW_COPY[view]}
        </Text>
        <TabList label="Card details">
          <Tab
            onClick={() => {
              setDetail("analysis");
            }}
            selected={detail === "analysis"}
          >
            Analysis
          </Tab>
          <Tab
            onClick={() => {
              setDetail("info");
            }}
            selected={detail === "info"}
          >
            Info
          </Tab>
        </TabList>
        <Text muted size="md">
          {detail === "analysis"
            ? "Role scores and the reasoning behind them."
            : "Oracle text, printings, and set information."}
        </Text>
      </Stack>
    </Card>
  );
}
