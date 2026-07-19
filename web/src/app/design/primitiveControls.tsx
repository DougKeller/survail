import { useState } from "react";

import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { Button } from "../../designsystem/primitives/button";
import { Card, CardKicker } from "../../designsystem/primitives/card";
import {
  Checkbox,
  Radio,
  Segmented,
  SegmentedButtons,
} from "../../designsystem/primitives/choice";
import { Disclosure } from "../../designsystem/primitives/disclosure";
import { Fieldset } from "../../designsystem/primitives/fieldset";
import { Field, Input, TextArea } from "../../designsystem/primitives/input";
import { Menu, MenuItem } from "../../designsystem/primitives/menu";
import { Meter } from "../../designsystem/primitives/progress";
import { Select } from "../../designsystem/primitives/select";
import { TooltipSurface } from "../../designsystem/primitives/tooltip";
import { Art } from "../../designsystem/primitives/artPlaceholder";

export function FormControlsCard() {
  const [title, setTitle] = useState("Tessa's Toolbox");
  const [notes, setNotes] = useState("1 Sol Ring\n1 Arcane Signet");
  const [format, setFormat] = useState("commander");
  return (
    <Card as="article" elevation="sm">
      <Stack gap={3}>
        <CardKicker>Input, TextArea, Select, Field</CardKicker>
        <Field
          hint="Shown on the deck tile and in exports."
          htmlFor="design-deck-title"
          label="Deck title"
        >
          <Input
            id="design-deck-title"
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            value={title}
          />
        </Field>
        <Field htmlFor="design-decklist" label="Decklist paste">
          <TextArea
            id="design-decklist"
            mono
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            rows={3}
            value={notes}
          />
        </Field>
        <Field htmlFor="design-format" label="Format">
          <Select
            id="design-format"
            onChange={(event) => {
              setFormat(event.target.value);
            }}
            options={[
              { label: "Commander", value: "commander" },
              { label: "Modern", value: "modern" },
              { label: "Standard", value: "standard" },
            ]}
            value={format}
          />
        </Field>
      </Stack>
    </Card>
  );
}

export function SelectionControlsCard() {
  const [zones, setZones] = useState<string[]>(["mainboard"]);
  const [copies, setCopies] = useState("1");
  const [zone, setZone] = useState("mainboard");
  const [view, setView] = useState("stacks");

  function toggleZone(zone: string): void {
    setZones((current) =>
      current.includes(zone)
        ? current.filter((entry) => entry !== zone)
        : [...current, zone],
    );
  }

  return (
    <Card as="article">
      <Stack gap={3}>
        <CardKicker>Fieldset, choice, Segmented, Meter</CardKicker>
        <Fieldset count={`${String(zones.length)}/3`} legend="Zones">
          {["commander", "mainboard", "considering"].map((zone) => (
            <Checkbox
              checked={zones.includes(zone)}
              key={zone}
              label={zone}
              onChange={() => {
                toggleZone(zone);
              }}
            />
          ))}
        </Fieldset>
        <Fieldset legend="Copies">
          {["1", "4"].map((count) => (
            <Radio
              checked={copies === count}
              key={count}
              label={`${count}x`}
              name="design-copies"
              onChange={() => {
                setCopies(count);
              }}
            />
          ))}
        </Fieldset>
        <Segmented
          label="Board filter"
          name="design-board-filter"
          onChange={setZone}
          options={[
            { label: "Commander", value: "commander" },
            { label: "Mainboard", value: "mainboard" },
            { label: "Considering", value: "considering" },
          ]}
          value={zone}
        />
        <SegmentedButtons
          label="Deck view"
          onChange={setView}
          options={[
            { label: "Stacks", value: "stacks" },
            { label: "Grid", value: "grid" },
            { label: "Text", value: "text" },
          ]}
          value={view}
        />
        <Meter label="Deck completion" max={99} value={58} />
        <Meter label="Ramp coverage" size="sm" tone="accent2" value={80} />
      </Stack>
    </Card>
  );
}

export function OverlayControlsCard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tooltipShown, setTooltipShown] = useState(false);
  return (
    <Card as="article">
      <Stack gap={3}>
        <CardKicker>Disclosure, Menu, Tooltip</CardKicker>
        <Disclosure count="2/5" inline label="Score filters">
          <Text muted size="sm">
            Disclosure panels expand in flow (inline) or float over the board.
          </Text>
        </Disclosure>
        <Inline gap={2}>
          <Text as="span" size="md">
            Deck tile actions
          </Text>
          <Menu
            id="design-actions-menu"
            label="Actions for Tessa's Toolbox"
            onToggle={() => {
              setMenuOpen((current) => !current);
            }}
            open={menuOpen}
          >
            <MenuItem
              onSelect={() => {
                setMenuOpen(false);
              }}
            >
              Rename deck
            </MenuItem>
            <MenuItem
              danger
              onSelect={() => {
                setMenuOpen(false);
              }}
            >
              Delete deck
            </MenuItem>
          </Menu>
        </Inline>
        <Button
          onClick={() => {
            setTooltipShown((current) => !current);
          }}
          variant="secondary"
        >
          {tooltipShown ? "Hide tooltip surface" : "Float tooltip surface"}
        </Button>
        {tooltipShown && (
          <TooltipSurface>
            <Art label="card preview" rounded size="sm" />
          </TooltipSurface>
        )}
      </Stack>
    </Card>
  );
}
