import { useEffect, useId, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import type { DeckTag } from "../../modules/decks/contracts";
import { Button, IconButton } from "../../designsystem/primitives/button";
import { Dialog } from "../../designsystem/primitives/dialog";
import { Field, Input } from "../../designsystem/primitives/input";
import { Text } from "../../designsystem/layout/typography";

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

export function TagColumnActions({
  busy,
  onDelete,
  onRename,
  tag,
}: {
  busy: boolean;
  onDelete: (tag: DeckTag) => Promise<boolean>;
  onRename: (tag: DeckTag, name: string) => Promise<boolean>;
  tag: DeckTag;
}) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <IconButton
        disabled={busy}
        label={`Rename ${tag.name} tag`}
        onClick={() => {
          setRenaming(true);
        }}
        size="sm"
        title="Rename tag"
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
      <TagNameDialog
        busy={busy}
        initialName={tag.name}
        onCancel={() => {
          if (!busy) setRenaming(false);
        }}
        onSubmit={(name) => {
          void onRename(tag, name).then((renamed) => {
            if (renamed) setRenaming(false);
            return undefined;
          });
        }}
        open={renaming}
        title="Rename tag"
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
