import { GripVertical } from "lucide-react";
import { useState, type DragEvent, type KeyboardEvent } from "react";

import type { DeckTag } from "../../modules/decks/contracts";
import { IconButton } from "../../designsystem/primitives/button";
import { useDeckCardsContext } from "./deckEditorContext";

const TAG_COLUMN_MIME = "application/x-survail-tag-column";

function orderedTags(tags: readonly DeckTag[]): DeckTag[] {
  return [...tags].sort(
    (left, right) =>
      left.position - right.position || left.name.localeCompare(right.name),
  );
}

export function reorderedTagIds(
  tags: readonly DeckTag[],
  sourceId: string,
  targetId: string,
  side: "after" | "before",
): string[] {
  const ids = orderedTags(tags).map((tag) => tag.id);
  if (sourceId === targetId || !ids.includes(sourceId)) return ids;
  const withoutSource = ids.filter((id) => id !== sourceId);
  const targetIndex = withoutSource.indexOf(targetId);
  if (targetIndex < 0) return ids;
  withoutSource.splice(targetIndex + (side === "after" ? 1 : 0), 0, sourceId);
  return withoutSource;
}

export function useTagColumnOrder(tag: DeckTag | null) {
  const {
    actions: { reorderTags },
    data: { busy },
    deck,
  } = useDeckCardsContext();
  const [active, setActive] = useState(false);
  const tags = deck.tags ?? [];

  const commit = (
    sourceId: string,
    targetId: string,
    side: "after" | "before",
  ): void => {
    const current = orderedTags(tags).map((item) => item.id);
    const next = reorderedTagIds(tags, sourceId, targetId, side);
    if (next.some((id, index) => id !== current[index])) void reorderTags(next);
  };

  const moveWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (tag === null) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = orderedTags(tags);
    const index = current.findIndex((item) => item.id === tag.id);
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    const target = current[index + direction];
    if (target === undefined) return;
    commit(tag.id, target.id, direction < 0 ? "before" : "after");
  };

  const dropProps =
    tag === null
      ? {}
      : {
          onDragEnter: (event: DragEvent<HTMLDivElement>) => {
            if (!event.dataTransfer.types.includes(TAG_COLUMN_MIME)) return;
            event.preventDefault();
            event.stopPropagation();
            setActive(true);
          },
          onDragLeave: (event: DragEvent<HTMLDivElement>) => {
            if (
              event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              return;
            setActive(false);
          },
          onDragOver: (event: DragEvent<HTMLDivElement>) => {
            if (!event.dataTransfer.types.includes(TAG_COLUMN_MIME)) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "move";
            setActive(true);
          },
          onDrop: (event: DragEvent<HTMLDivElement>) => {
            const sourceId = event.dataTransfer.getData(TAG_COLUMN_MIME);
            if (sourceId === "") return;
            event.preventDefault();
            event.stopPropagation();
            const bounds = event.currentTarget.getBoundingClientRect();
            const side =
              event.clientX > bounds.left + bounds.width / 2
                ? "after"
                : "before";
            setActive(false);
            commit(sourceId, tag.id, side);
          },
        };

  return {
    active,
    dropProps,
    handle:
      tag === null ? null : (
        <IconButton
          dragHandle
          disabled={busy}
          draggable={!busy}
          label={`Move ${tag.name} tag column`}
          onDragEnd={() => {
            setActive(false);
          }}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(TAG_COLUMN_MIME, tag.id);
          }}
          onKeyDown={moveWithKeyboard}
          size="sm"
          title="Drag to reorder; use Left and Right arrow keys"
          variant="ghost"
        >
          <GripVertical size={14} strokeWidth={2.75} />
        </IconButton>
      ),
  };
}
