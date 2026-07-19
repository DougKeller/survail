import { useEffect, useId, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import type { CardSet, DeckTag } from "../../modules/decks/contracts";
import { Button, IconButton } from "../../designsystem/primitives/button";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Field, Input } from "../../designsystem/primitives/input";
import { Meter } from "../../designsystem/primitives/progress";
import { Inline } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { Text } from "../../designsystem/layout/typography";
import { formattedTagProgress, tagTargetProgress } from "../deck/tagTargets";

export function TagNameDialog({
  busy,
  initialName,
  onCancel,
  onSubmit,
  open,
  title,
}: {
  busy: boolean;
  initialName: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
  open: boolean;
  title: "New tag" | "Rename tag";
}) {
  const inputId = useId();
  const [name, setName] = useState(initialName);
  useEffect(() => {
    if (open) setName(initialName);
  }, [initialName, open]);
  const trimmedName = name.trim();
  const submitLabel = title === "New tag" ? "Create tag" : "Save tag";
  const submit = (): void => {
    if (trimmedName !== "" && !busy) onSubmit(trimmedName);
  };
  return (
    <Dialog
      actions={
        <>
          <Button disabled={busy} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button disabled={busy || trimmedName === ""} onClick={submit}>
            {submitLabel}
          </Button>
        </>
      }
      busy={busy}
      onClose={onCancel}
      open={open}
      title={title}
    >
      <Field htmlFor={inputId} label="Tag name">
        <Input
          autoFocus
          id={inputId}
          maxLength={64}
          onChange={(event) => {
            setName(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          value={name}
        />
      </Field>
    </Dialog>
  );
}

function DeleteTagDialog({
  busy,
  onCancel,
  onConfirm,
  tag,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  tag: DeckTag | null;
}) {
  return (
    <Dialog
      actions={
        <>
          <Button disabled={busy} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button disabled={busy} onClick={onConfirm}>
            Delete tag
          </Button>
        </>
      }
      busy={busy}
      description="This also removes the tag from every card in this deck."
      onClose={onCancel}
      open={tag !== null}
      title={`Delete ${tag?.name ?? "tag"}?`}
    >
      <Text>This cannot be undone.</Text>
    </Dialog>
  );
}

function EditTagDialog({
  busy,
  onCancel,
  onSubmit,
  open,
  tag,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (name: string, target: number) => void;
  open: boolean;
  tag: DeckTag;
}) {
  const nameId = useId();
  const targetId = useId();
  const [name, setName] = useState(tag.name);
  const [target, setTarget] = useState(String(tag.target));
  useEffect(() => {
    if (open) {
      setName(tag.name);
      setTarget(String(tag.target));
    }
  }, [open, tag.name, tag.target]);
  const trimmedName = name.trim();
  const numericTarget = Number(target);
  const validTarget = target.trim() !== "" && numericTarget >= 0;
  const submit = (): void => {
    if (trimmedName !== "" && validTarget && !busy)
      onSubmit(trimmedName, numericTarget);
  };
  return (
    <Dialog
      actions={
        <>
          <Button disabled={busy} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={busy || trimmedName === "" || !validTarget}
            onClick={submit}
          >
            Save tag
          </Button>
        </>
      }
      busy={busy}
      onClose={onCancel}
      open={open}
      title="Edit tag"
    >
      <Stack gap={3}>
        <Field htmlFor={nameId} label="Tag name">
          <Input
            autoFocus
            id={nameId}
            maxLength={64}
            onChange={(event) => {
              setName(event.target.value);
            }}
            value={name}
          />
        </Field>
        <Field htmlFor={targetId} label="Target contribution">
          <Input
            id={targetId}
            min={0}
            onChange={(event) => {
              setTarget(event.target.value);
            }}
            step={0.25}
            type="number"
            value={target}
          />
        </Field>
      </Stack>
    </Dialog>
  );
}

export function TagTargetProgress({
  cards,
  tag,
}: {
  cards: readonly CardSet[];
  tag: DeckTag;
}) {
  const current = tagTargetProgress(cards, tag);
  return (
    <Stack gap={1}>
      <Inline align="center" gap={2} justify="between">
        <Text as="span" muted size="2xs">
          Weighted progress
        </Text>
        <Text as="span" muted size="2xs">
          {tag.target === 0
            ? `${formattedTagProgress(current)} · No target`
            : `${formattedTagProgress(current)} / ${formattedTagProgress(tag.target)}`}
        </Text>
      </Inline>
      {tag.target > 0 && (
        <Meter
          label={`${tag.name} target progress`}
          max={tag.target}
          size="sm"
          value={current}
        />
      )}
    </Stack>
  );
}

export function TagColumnActions({
  busy,
  onDelete,
  onUpdate,
  tag,
}: {
  busy: boolean;
  onDelete: (tag: DeckTag) => Promise<boolean>;
  onUpdate: (tag: DeckTag, name: string, target: number) => Promise<boolean>;
  tag: DeckTag;
}) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <IconButton
        disabled={busy}
        label={`Edit ${tag.name} tag`}
        onClick={() => {
          setRenaming(true);
        }}
        size="sm"
        title="Edit tag"
        variant="ghost"
      >
        <Pencil size={14} strokeWidth={2.75} />
      </IconButton>
      <IconButton
        disabled={busy}
        label={`Delete ${tag.name} tag`}
        onClick={() => {
          setDeleting(true);
        }}
        size="sm"
        title="Delete tag"
        variant="ghost"
      >
        <Trash2 size={14} strokeWidth={2.75} />
      </IconButton>
      <EditTagDialog
        busy={busy}
        onCancel={() => {
          if (!busy) setRenaming(false);
        }}
        onSubmit={(name, target) => {
          void onUpdate(tag, name, target).then((updated) => {
            if (updated) setRenaming(false);
            return undefined;
          });
        }}
        open={renaming}
        tag={tag}
      />
      <DeleteTagDialog
        busy={busy}
        onCancel={() => {
          if (!busy) setDeleting(false);
        }}
        onConfirm={() => {
          void onDelete(tag).then((deleted) => {
            if (deleted) setDeleting(false);
            return undefined;
          });
        }}
        tag={deleting ? tag : null}
      />
    </>
  );
}
