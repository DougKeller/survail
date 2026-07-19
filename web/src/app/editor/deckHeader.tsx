import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  CircleCheck,
  CircleAlert,
  History,
  ListPlus,
  MessageSquare,
  MoreVertical,
  Sparkles,
  SquarePen,
  Trash2,
} from "lucide-react";

import { Button, IconButton } from "../../designsystem/primitives/button";
import { Chip } from "../../designsystem/primitives/chip";
import { NavBar, NavBrand, NavLink } from "../../designsystem/primitives/nav";
import { Popover, PopoverAnchor } from "../../designsystem/primitives/popover";
import { StatusDot } from "../../designsystem/primitives/statusDot";
import { TabButton, TabNav } from "../../designsystem/primitives/tabs";
import { Tag } from "../../designsystem/primitives/tag";
import { FlexSpacer } from "../../designsystem/layout/inline";
import { Stack } from "../../designsystem/layout/stack";
import { titleize } from "../deckPrimitives";
import { useDismissibleSurface } from "../deck/hooks";
import {
  useDeckAdvisorContext,
  useDeckEditorContext,
} from "./deckEditorContext";

const ICON = { size: 15, strokeWidth: 2.75 } as const;

function DeckActionsMenu() {
  const {
    actions: { handleDelete },
    modals: { openBulkEdit, setShowEditDeck },
  } = useDeckEditorContext();
  const [open, setOpen] = useState(false);
  const menuRef = useDismissibleSurface<HTMLDivElement>(
    open,
    () => {
      setOpen(false);
    },
    { manageFocus: false },
  );
  const closeThen = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <PopoverAnchor ref={menuRef}>
      <IconButton
        aria-expanded={open}
        aria-haspopup="dialog"
        label="More deck actions"
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <MoreVertical {...ICON} />
      </IconButton>
      {open && (
        <Popover align="end" label="Deck actions">
          <Stack gap={1}>
            <Button
              alignStart
              block
              icon={<SquarePen {...ICON} />}
              onClick={closeThen(() => {
                setShowEditDeck(true);
              })}
              variant="ghost"
            >
              Edit
            </Button>
            <Button
              alignStart
              block
              icon={<ListPlus {...ICON} />}
              onClick={closeThen(openBulkEdit)}
              variant="ghost"
            >
              Bulk edit decklist
            </Button>
            <Button
              alignStart
              block
              icon={<Trash2 {...ICON} />}
              onClick={closeThen(() => void handleDelete())}
              variant="ghost"
            >
              Delete deck
            </Button>
          </Stack>
        </Popover>
      )}
    </PopoverAnchor>
  );
}

export function DeckHeader() {
  const navigate = useNavigate();
  const {
    data: { validation },
    deck,
    display: { editorView, scoringEnabled, setEditorView },
    modals: { setOpenDialog },
  } = useDeckEditorContext();
  const { setShowAgent, showAgent } = useDeckAdvisorContext();
  const valid = validation?.valid === true;
  return (
    <>
      <NavBar aria-label="Deck controls" divided>
        <NavLink
          aria-label="Back to decks"
          href="/decks"
          onClick={(event) => {
            event.preventDefault();
            void navigate("/decks");
          }}
        >
          <ChevronLeft size={18} strokeWidth={2.75} />
        </NavLink>
        <NavBrand>{deck.title}</NavBrand>
        <Tag tone="accent">{titleize(deck.format)}</Tag>
        <Chip icon={<StatusDot />}>saved · rev {deck.revision}</Chip>
        <Chip
          aria-label={`${valid ? "Valid deck" : "Deck needs attention"}, ${String(validation?.card_count ?? 0)} cards`}
          icon={valid ? <CircleCheck {...ICON} /> : <CircleAlert {...ICON} />}
          onClick={() => {
            setOpenDialog("validation");
          }}
          title={valid ? "Valid deck" : "Deck needs attention"}
        />
        <FlexSpacer />
        <Button
          aria-pressed={showAgent}
          icon={<MessageSquare {...ICON} />}
          onClick={() => {
            setShowAgent((current) => !current);
          }}
          variant="secondary"
        >
          Advisor
        </Button>
        <Button
          icon={<CircleCheck {...ICON} />}
          onClick={() => {
            setOpenDialog("validation");
          }}
          variant="secondary"
        >
          Validate
        </Button>
        <IconButton
          label="History"
          onClick={() => {
            setOpenDialog("history");
          }}
        >
          <History size={16} strokeWidth={2.75} />
        </IconButton>
        <Button
          icon={<Sparkles {...ICON} />}
          onClick={() => {
            setOpenDialog("describe");
          }}
        >
          Describe
        </Button>
        <DeckActionsMenu />
      </NavBar>
      <TabNav label="Deck views">
        {(["cards", "scores", "charts", "info"] as const)
          .filter((view) => scoringEnabled || view !== "scores")
          .map((view) => (
            <TabButton
              current={editorView === view}
              key={view}
              onClick={() => {
                setEditorView(view);
              }}
            >
              {titleize(view)}
            </TabButton>
          ))}
      </TabNav>
    </>
  );
}
