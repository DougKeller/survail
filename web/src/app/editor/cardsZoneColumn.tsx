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
import { useDeckEditorContext } from "./deckEditorContext";
import { RoleTargetForColumn } from "./roleTargetColumn";
import { useCardZoneDrag } from "./cardZoneDrag";
import { TagColumnActions } from "./tagControls";
import { CardTagPicker } from "./cardTagPicker";

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
      renameTag,
    },
    data: { busy },
    deck,
    display: { displayPreferences },
    modals: { setActiveCardNote },
    scoring: { scores },
  } = useDeckEditorContext();
  const drag = useCardZoneDrag();
  const tag = deck.tags?.find((item) => item.id === tagId) ?? null;
  const tagDropProps =
    tagId === null || tagId === undefined ? {} : drag.tagColumnProps(tagId);
  return (
    <CardZoneColumn
      {...tagDropProps}
      active={tagId !== null && tagId === drag.activeTagTarget}
      aria-label={`${label}, ${String(quantity)} cards`}
    >
      <ColumnHeader
        level={3}
        title={`${label} · ${String(quantity)} ${quantity === 1 ? "card" : "cards"}`}
      >
        {tag !== null && (
          <TagColumnActions
            busy={busy}
            onDelete={(target) => {
              return deleteTag(target.id, target.name);
            }}
            onRename={(target, name) => {
              return renameTag(target.id, name);
            }}
            tag={tag}
          />
        )}
      </ColumnHeader>
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
            tagAction={
              displayPreferences.groupBy === "tags"
                ? (card) => <CardTagPicker card={card} />
                : undefined
            }
            view={displayPreferences.view}
          />
        )}
      </CardZoneColumnContent>
    </CardZoneColumn>
  );
}
