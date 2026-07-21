import { Fragment } from "react";

import type { CardSet } from "../../modules/decks/contracts";
import {
  CardZoneColumn,
  CardZoneColumnContent,
  CardZoneReorderGhost,
} from "../../designsystem/layout/cardZoneWorkspace";
import { ColumnHeader } from "../../designsystem/patterns/columnHeader";
import { VisualCardColumn } from "../deckPrimitives";
import type { CardZoneMatrixRowZone } from "../deck/cardZoneMatrix";
import type {
  RoleTargetProgressByRole,
  RoleTargetRole,
  RoleTargetSetting,
  RoleTargets,
} from "../deck/roleTargets";
import { TextCardColumn } from "./boardView";
import { useDeckCardsContext } from "./deckEditorContext";
import { RoleTargetForColumn } from "./roleTargetColumn";
import { useCardZoneDrag } from "./cardZoneDrag";
import { CREATE_TAG_DROP_ID } from "./cardZoneDragTypes";
import { TagColumnActions, TagTargetProgress } from "./tagControls";
import { CardTagPicker } from "./cardTagPicker";
import { useTagColumnOrder } from "./tagColumnOrder";

export function CardsZoneColumn({
  cards,
  label,
  onPreview,
  onRoleTargetChange,
  quantity,
  roleProgress,
  roleTargets,
  tagId,
  zone,
}: {
  cards: CardSet[];
  label: string;
  onPreview: (card: CardSet) => void;
  onRoleTargetChange: (
    role: RoleTargetRole,
    setting: RoleTargetSetting,
  ) => void;
  quantity: number;
  roleProgress: RoleTargetProgressByRole;
  roleTargets: RoleTargets;
  tagId?: string | null | undefined;
  zone: CardZoneMatrixRowZone;
}) {
  const {
    actions: {
      changeQuantity,
      deleteTag,
      markAsCommander,
      removeTagFromCard,
      updateTag,
    },
    data: { busy },
    deck,
    display: { displayPreferences },
    modals: { setActiveCardNote },
    scoring: { scores },
  } = useDeckCardsContext();
  const drag = useCardZoneDrag();
  const tag = deck.tags?.find((item) => item.id === tagId) ?? null;
  const tagOrder = useTagColumnOrder(tag);
  const tagDropProps =
    tagId === null || tagId === undefined
      ? {}
      : drag.tagColumnProps(tagId, zone);
  const column = (
    <CardZoneColumn
      {...tagDropProps}
      active={
        tagId !== null &&
        tagId === drag.activeTagTarget &&
        zone === drag.activeTagZone
      }
      aria-label={`${label}, ${String(quantity)} cards`}
      className={
        tagOrder.dragging ? "ds-cards-zone-column-reorder-source" : undefined
      }
      data-reorder-tag-id={tag?.id}
      hint={
        tag !== null &&
        tag.id === drag.activeTagTarget &&
        zone === drag.activeTagZone
          ? `Add to ${tag.name}`
          : undefined
      }
    >
      <ColumnHeader
        {...tagOrder.dropProps}
        count={quantity}
        leading={tagOrder.handle}
        level={3}
        tone="default"
        title={label}
      >
        {tag !== null && (
          <TagColumnActions
            busy={busy}
            onDelete={(target) => {
              return deleteTag(target.id, target.name);
            }}
            onUpdate={(target, name, nextTarget) => {
              return updateTag(target.id, name, nextTarget);
            }}
            tag={tag}
          />
        )}
      </ColumnHeader>
      {tag !== null && zone === "mainboard" && (
        <TagTargetProgress cards={cards} tag={tag} />
      )}
      {zone === "mainboard" && displayPreferences.groupBy === "role" && (
        <RoleTargetForColumn
          label={label}
          onChange={onRoleTargetChange}
          progress={roleProgress}
          targets={roleTargets}
        />
      )}
      <CardZoneColumnContent>
        {displayPreferences.view === "text" ? (
          <TextCardColumn
            cards={cards}
            columnLabel={label}
            onPreview={onPreview}
            removeContextTag={
              tag === null
                ? undefined
                : (card) => {
                    removeTagFromCard(card, tag.id, tag.name);
                  }
            }
            tagAction={
              displayPreferences.groupBy === "tags"
                ? (card) => <CardTagPicker card={card} />
                : undefined
            }
          />
        ) : (
          <VisualCardColumn
            addCard={(card) => {
              changeQuantity(card, 1);
            }}
            busy={busy}
            cards={cards}
            columnLabel={label}
            editCardNote={setActiveCardNote}
            format={deck.format}
            markCommander={markAsCommander}
            removeCard={(card) => {
              changeQuantity(card, -1);
            }}
            removeContextTag={
              tag === null
                ? undefined
                : (card) => {
                    removeTagFromCard(card, tag.id, tag.name);
                  }
            }
            scores={scores}
            tagAction={(card) => <CardTagPicker card={card} />}
            tags={deck.tags ?? []}
            view={displayPreferences.view}
          />
        )}
      </CardZoneColumnContent>
    </CardZoneColumn>
  );
  if (tagOrder.ghostSide === null) return column;
  const ghost = <CardZoneReorderGhost />;
  return (
    <Fragment>
      {tagOrder.ghostSide === "before" && ghost}
      {column}
      {tagOrder.ghostSide === "after" && ghost}
    </Fragment>
  );
}

export function NewTagZoneColumn({ zone }: { zone: CardZoneMatrixRowZone }) {
  const drag = useCardZoneDrag();
  const active =
    drag.activeTagTarget === CREATE_TAG_DROP_ID && zone === drag.activeTagZone;
  return (
    <CardZoneColumn
      {...drag.tagColumnProps(CREATE_TAG_DROP_ID, zone)}
      active={active}
      aria-label="New tag drop target"
      className="ds-cards-zone-column-new-tag"
      hint={active ? "Create a tag" : undefined}
    >
      <ColumnHeader count={0} level={3} title="New tag" />
      <CardZoneColumnContent>
        Drop a card here to create a tag
      </CardZoneColumnContent>
    </CardZoneColumn>
  );
}
