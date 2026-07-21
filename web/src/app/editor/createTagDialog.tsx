import type { CardSet } from "../../modules/decks/contracts";
import { TagNameDialog } from "./tagControls";

export function CreateTagDialog({
  busy,
  card,
  createTag,
  onClose,
  open,
}: {
  busy: boolean;
  card: CardSet | null;
  createTag: (name: string, card?: CardSet) => Promise<boolean>;
  onClose: () => void;
  open: boolean;
}) {
  return (
    <TagNameDialog
      busy={busy}
      initialName=""
      onCancel={() => {
        if (!busy) onClose();
      }}
      onSubmit={(name) => {
        void createTag(name, card ?? undefined).then((created) => {
          if (created) onClose();
          return undefined;
        });
      }}
      open={open}
      title="New tag"
    />
  );
}
