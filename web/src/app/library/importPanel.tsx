import type { ChangeEvent, Dispatch, SetStateAction } from "react";

import { SplitPane } from "../../designsystem/layout/divided";
import { Stack } from "../../designsystem/layout/stack";
import { Heading, Text } from "../../designsystem/layout/typography";
import { Button } from "../../designsystem/primitives/button";
import { Checkbox } from "../../designsystem/primitives/choice";
import { Field, Input, TextArea } from "../../designsystem/primitives/input";
import { Select } from "../../designsystem/primitives/select";
import { DECK_FORMATS } from "../deckPrimitives";
import { ImportPreviewPanel } from "./importPreviewPanel";

import type { DeckFormat } from "../../modules/decks/contracts";
import type {
  ImportPreferences,
  MoxfieldImportPreview,
} from "../../modules/imports/contracts";

const FORMAT_OPTIONS = DECK_FORMATS.map((deckFormat) => ({
  label: deckFormat,
  value: deckFormat,
}));

export function ImportPanel({
  busy,
  createDeck,
  createImportedDeck,
  decklist,
  format,
  handleFormatChange,
  handlePreview,
  importPreferences,
  preview,
  setDecklist,
  setImportPreferences,
  title,
  setTitle,
}: {
  busy: boolean;
  createDeck: () => Promise<void>;
  createImportedDeck: () => Promise<void>;
  decklist: string;
  format: DeckFormat;
  handleFormatChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  handlePreview: () => Promise<void>;
  importPreferences: ImportPreferences;
  preview: MoxfieldImportPreview | null;
  setDecklist: (value: string) => void;
  setImportPreferences: Dispatch<SetStateAction<ImportPreferences>>;
  setTitle: (value: string) => void;
  title: string;
}) {
  return (
    <SplitPane ratio="wide-end" tint="end">
      <Stack gap={4}>
        <Heading level={2} size="2xl">
          Start fresh
        </Heading>
        <Field htmlFor="import-deck-title" label="Deck title">
          <Input
            id="import-deck-title"
            maxLength={120}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            required
            value={title}
          />
        </Field>
        <Field htmlFor="import-deck-format" label="Format">
          <Select
            id="import-deck-format"
            onChange={handleFormatChange}
            options={FORMAT_OPTIONS}
            required
            value={format}
          />
        </Field>
        <Button
          block
          disabled={busy || title.trim() === ""}
          onClick={() => void createDeck()}
        >
          Create deck
        </Button>
      </Stack>
      <Stack gap={3}>
        <Heading level={2} size="2xl">
          Import Moxfield decklist
        </Heading>
        <Text muted size="md">
          Paste an exported list. Imported cards begin in the Mainboard; move
          commanders and sideboard cards after creation. Imports resolve to the
          original non-foil printing when available.
        </Text>
        <Field htmlFor="import-decklist" label="Decklist">
          <TextArea
            id="import-decklist"
            mono
            onChange={(event) => {
              setDecklist(event.target.value);
            }}
            placeholder={"1 Arcane Signet (CMM) 379\n1 Sol Ring (CMM) 396"}
            required
            value={decklist}
          />
        </Field>
        <Checkbox
          checked={importPreferences.preserveTags}
          label="Preserve tags"
          onChange={(event) => {
            setImportPreferences({ preserveTags: event.target.checked });
          }}
        />
        <Button
          disabled={busy}
          onClick={() => void handlePreview()}
          variant="secondary"
        >
          {busy ? "Resolving…" : "Preview import"}
        </Button>
        <ImportPreviewPanel
          busy={busy}
          createImportedDeck={createImportedDeck}
          preview={preview}
          title={title}
        />
      </Stack>
    </SplitPane>
  );
}
