import type { CardSet } from "../../modules/decks/contracts";
import {
  CardZoneColumn,
  CardZoneColumnContent,
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
    tagId === null || tagId === undefined ? {} : drag.tagColumnProps(tagId);
  return (
    <CardZoneColumn
      {...tagDropProps}
      active={tagId !== null && tagId === drag.activeTagTarget}
      aria-label={`${label}, ${String(quantity)} cards`}
    >
      <ColumnHeader
        {...tagOrder.dropProps}
        level={3}
        tone={tagOrder.active ? "accent" : "default"}
        title={`${label} · ${String(quantity)} ${quantity === 1 ? "card" : "cards"}`}
      >
        {tag !== null && (
          <>
            {tagOrder.handle}
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
          </>
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
}
